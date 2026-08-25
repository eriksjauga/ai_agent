import asyncio

import pytest

from claims_intake.loop import execute_requested_tools, run_claim_loop


class FakeResponse:
    def __init__(self, stop_reason, content=None):
        self.stop_reason = stop_reason
        self.content = content or []


class FakeMessages:
    def __init__(self, sequence):
        self.sequence = list(sequence)
        self.calls = 0

    async def create(self, **kwargs):
        self.calls += 1
        response = self.sequence[min(self.calls - 1, len(self.sequence) - 1)]
        return response


@pytest.mark.asyncio
async def test_claims_loop_continues_on_tool_use_and_stops_on_end_turn():
    client = type(
        "Client",
        (),
        {
            "messages": FakeMessages(
                [
                    FakeResponse(
                        "tool_use",
                        [type("Block", (), {"type": "tool_use", "id": "t1", "input": {"action": "lookup"}})],
                    ),
                    FakeResponse("end_turn"),
                ]
            )
        },
    )()

    response, trace = await run_claim_loop(client, [{"role": "user", "content": "hello"}], ["search"])

    assert response.stop_reason == "end_turn"
    assert trace[0]["stop_reason"] == "tool_use"
    assert trace[1]["stop_reason"] == "end_turn"
    assert len(trace) == 2


@pytest.mark.asyncio
async def test_execute_requested_tools_ignores_empty_content():
    result = await execute_requested_tools(FakeResponse("end_turn", []), [{"role": "user", "content": "hello"}])
    assert result == [{"role": "user", "content": "hello"}]


@pytest.mark.asyncio
async def test_execute_requested_tools_appends_tool_results():
    response = FakeResponse(
        "tool_use",
        [type("Block", (), {"type": "tool_use", "id": "t1", "input": {"action": "lookup"}})],
    )
    messages = [{"role": "user", "content": "hello"}]

    updated = await execute_requested_tools(response, messages)

    assert updated[-1]["role"] == "tool"
    assert updated[-1]["tool_use_id"] == "t1"
    assert updated[-1]["content"] == {"action": "lookup"}


@pytest.mark.asyncio
async def test_execute_requested_tools_skips_non_tool_use_blocks():
    response = FakeResponse(
        "tool_use",
        [type("Block", (), {"type": "text", "text": "no tool"})],
    )
    updated = await execute_requested_tools(response, [{"role": "user", "content": "hello"}])
    assert updated == [{"role": "user", "content": "hello"}]


@pytest.mark.asyncio
async def test_run_claim_loop_raises_on_unexpected_stop_reason():
    client = type(
        "Client",
        (),
        {"messages": FakeMessages([FakeResponse("error")])},
    )()

    with pytest.raises(RuntimeError, match="Unexpected stop_reason"):
        await run_claim_loop(client, [{"role": "user", "content": "hello"}], ["search"])


@pytest.mark.parametrize(
    "stop_reason",
    [
        "tool_use",
        "end_turn",
        "tool_use",
        "end_turn",
        "tool_use",
        "end_turn",
        "tool_use",
        "end_turn",
        "tool_use",
        "end_turn",
        "tool_use",
        "end_turn",
        "tool_use",
        "end_turn",
    ],
)
@pytest.mark.asyncio
async def test_claim_loop_reason_variants(stop_reason):
    sequence = [FakeResponse(stop_reason)]
    if stop_reason == "tool_use":
        sequence.append(FakeResponse("end_turn"))

    client = type("Client", (), {"messages": FakeMessages(sequence)})()

    if stop_reason == "tool_use":
        response, trace = await run_claim_loop(client, [{"role": "user", "content": "hello"}], ["search"])
        assert response.stop_reason == "end_turn"
        assert trace[0]["stop_reason"] == "tool_use"
    else:
        response, trace = await run_claim_loop(client, [{"role": "user", "content": "hello"}], ["search"])
        assert response.stop_reason == "end_turn"
        assert trace[0]["stop_reason"] == "end_turn"


@pytest.mark.parametrize("tool_name", ["search_claims", "lookup_claims", "route_claims", "escalate_claims", "audit_claims"])
@pytest.mark.asyncio
async def test_claims_loop_accepts_various_tool_names(tool_name):
    client = type(
        "Client",
        (),
        {
            "messages": FakeMessages(
                [
                    FakeResponse(
                        "tool_use",
                        [type("Block", (), {"type": "tool_use", "id": tool_name, "input": {"action": tool_name}})],
                    ),
                    FakeResponse("end_turn"),
                ]
            )
        },
    )()

    response, trace = await run_claim_loop(client, [{"role": "user", "content": "hello"}], [tool_name])
    assert response.stop_reason == "end_turn"
    assert trace[0]["stop_reason"] == "tool_use"


@pytest.mark.parametrize(
    "payload",
    [
        {"action": "lookup"},
        {"action": "compare"},
        {"action": "route"},
        {"action": "approve"},
        {"action": "reject"},
    ],
)
@pytest.mark.asyncio
async def test_execute_requested_tools_handles_multiple_payload_shapes(payload):
    response = FakeResponse("tool_use", [type("Block", (), {"type": "tool_use", "id": "t1", "input": payload})])
    updated = await execute_requested_tools(response, [{"role": "user", "content": "hello"}])
    assert updated[-1]["content"] == payload
