import asyncio

import pytest

from claims_intake.loop import run_claim_loop


class FakeResponse:
    def __init__(self, stop_reason, content=None):
        self.stop_reason = stop_reason
        self.content = content or []


class FakeClient:
    def __init__(self):
        self.calls = []

    async def messages_create(self, **kwargs):
        self.calls.append(kwargs)
        if not self.calls:
            return FakeResponse("tool_use", [type("Block", (), {"type": "tool_use", "id": "t1", "input": {"action": "lookup"}})])
        return FakeResponse("end_turn")

    async def create(self, **kwargs):
        return await self.messages_create(**kwargs)


@pytest.mark.asyncio
async def test_claims_loop_continues_on_tool_use_and_stops_on_end_turn():
    client = type("C", (), {"messages": type("M", (), {"create": lambda self, **kwargs: asyncio.sleep(0, result=FakeResponse("tool_use", [type("Block", (), {"type": "tool_use", "id": "t1", "input": {"action": "lookup"}})]))})()})()

    async def fake_create(**kwargs):
        if len(client.messages.create.__self__ if hasattr(client.messages.create, '__self__') else []) == 0:
            return FakeResponse("tool_use", [type("Block", (), {"type": "tool_use", "id": "t1", "input": {"action": "lookup"}})])
        return FakeResponse("end_turn")

    class Messages:
        def __init__(self):
            self.calls = 0

        async def create(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                return FakeResponse("tool_use", [type("Block", (), {"type": "tool_use", "id": "t1", "input": {"action": "lookup"}})])
            return FakeResponse("end_turn")

    client = type("Client", (), {"messages": Messages()})()
    response, trace = await run_claim_loop(client, [{"role": "user", "content": "hello"}], ["search"])

    assert response.stop_reason == "end_turn"
    assert trace[0]["stop_reason"] == "tool_use"
    assert trace[1]["stop_reason"] == "end_turn"
    assert len(trace) == 2
