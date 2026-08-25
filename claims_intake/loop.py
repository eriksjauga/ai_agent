"""Stop-reason driven claims intake loop."""

from __future__ import annotations

from typing import Any, Dict, List


async def execute_requested_tools(response: Any, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Append tool results from a tool_use response back into the message history."""
    tool_calls = getattr(response, "content", []) or []
    if not tool_calls:
        return messages

    tool_results: List[Dict[str, Any]] = []
    for block in tool_calls:
        if getattr(block, "type", None) == "tool_use":
            tool_results.append(
                {
                    "role": "tool",
                    "tool_use_id": getattr(block, "id", "tool_use_1"),
                    "content": getattr(block, "input", {}),
                }
            )

    if not tool_results:
        return messages

    updated = list(messages)
    updated.extend(tool_results)
    return updated


async def run_claim_loop(client: Any, messages: List[Dict[str, Any]], tools: List[str]):
    """Drive the claims loop until the model stops with end_turn."""
    trace: List[Dict[str, Any]] = []
    while True:
        response = await client.messages.create(
            model="claude-haiku-baseline",
            messages=messages,
            tools=tools,
        )
        trace.append({"turn": len(trace) + 1, "stop_reason": response.stop_reason})

        if response.stop_reason == "tool_use":
            messages = await execute_requested_tools(response, messages)
            continue
        if response.stop_reason == "end_turn":
            return response, trace
        raise RuntimeError(f"Unexpected stop_reason: {response.stop_reason}")
