#!/usr/bin/env python3
"""vLLM offline inference adapter for Bun.spawn() IPC.

Protocol:
- Read one JSON object per stdin line.
- Write one JSON object per stdout line.

Request envelope:
{
  "id": "req-1",
  "type": "init" | "infer" | "health" | "shutdown",
  "detail": { ... }
}

Response envelope:
{
  "id": "req-1",
  "ok": true | false,
  "detail": { ... } | null,
  "error": { "message": "...", "code": "..." } | null
}

This adapter intentionally stays minimal: prompt rendering / event mapping should
live in the caller (TypeScript/Bun), while Python owns model lifecycle and token
generation.

Runtime lanes:
- analyst: google/gemma-4-31B-it
- coder: google/gemma-4-26B-A4B-it
"""

from __future__ import annotations

import json
import sys
import time
import traceback
from dataclasses import dataclass
from typing import Any

try:
    from vllm import LLM, SamplingParams
except Exception as import_error:  # pragma: no cover - surfaced at init.
    LLM = None  # type: ignore[assignment]
    SamplingParams = None  # type: ignore[assignment]
    VLLM_IMPORT_ERROR = import_error
else:
    VLLM_IMPORT_ERROR = None


JsonDict = dict[str, Any]
RuntimeRole = str
InferMode = str

RUNTIME_ANALYST: RuntimeRole = "analyst"
RUNTIME_CODER: RuntimeRole = "coder"
SUPPORTED_RUNTIMES: tuple[RuntimeRole, RuntimeRole] = (RUNTIME_ANALYST, RUNTIME_CODER)
INFER_MODE_GENERATE: InferMode = "generate"
INFER_MODE_CHAT: InferMode = "chat"
DEFAULT_MODELS: dict[RuntimeRole, str] = {
    RUNTIME_ANALYST: "google/gemma-4-31B-it",
    RUNTIME_CODER: "google/gemma-4-26B-A4B-it",
}


@dataclass
class RuntimeState:
    llm: Any | None = None
    model: str = ""
    initialized_at_ms: int | None = None
    engine_args: JsonDict | None = None


@dataclass
class VllmState:
    runtimes: dict[RuntimeRole, RuntimeState]


STATE = VllmState(
    runtimes={
        runtime: RuntimeState(model=model)
        for runtime, model in DEFAULT_MODELS.items()
    }
)


def write_response(
    *,
    request_id: str | None,
    ok: bool,
    detail: JsonDict | None = None,
    error: JsonDict | None = None,
) -> None:
    payload: JsonDict = {
        "id": request_id,
        "ok": ok,
        "detail": detail,
        "error": error,
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def fail(
    *,
    request_id: str | None,
    code: str,
    message: str,
    include_traceback: bool = False,
) -> None:
    error: JsonDict = {"code": code, "message": message}
    if include_traceback:
        error["traceback"] = traceback.format_exc()
    write_response(request_id=request_id, ok=False, error=error)


def parse_sampling_params(raw: Any) -> Any:
    _, sampling_params_cls = require_vllm_symbols()
    if raw is None:
        return sampling_params_cls()
    if not isinstance(raw, dict):
        raise ValueError("detail.sampling must be an object when provided.")
    return sampling_params_cls(**raw)


def parse_runtime(raw: Any, *, field_name: str) -> RuntimeRole:
    if not isinstance(raw, str) or not raw:
        raise ValueError(f"{field_name} must be a non-empty string.")
    if raw not in SUPPORTED_RUNTIMES:
        supported = ", ".join(SUPPORTED_RUNTIMES)
        raise ValueError(f"{field_name} must be one of: {supported}.")
    return raw


def parse_runtime_targets(raw: Any) -> list[RuntimeRole]:
    if raw is None or raw == "all":
        return list(SUPPORTED_RUNTIMES)
    if isinstance(raw, str):
        return [parse_runtime(raw, field_name="detail.runtime")]
    raise ValueError('detail.runtime must be "analyst", "coder", or "all".')


def parse_engine_args(raw: Any, *, field_name: str) -> JsonDict:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError(f"{field_name} must be an object when provided.")
    return raw


def parse_optional_bool(raw: Any, *, field_name: str, default: bool) -> bool:
    if raw is None:
        return default
    if not isinstance(raw, bool):
        raise ValueError(f"{field_name} must be a boolean when provided.")
    return raw


def require_vllm_symbols() -> tuple[Any, Any]:
    if LLM is None or SamplingParams is None:
        if VLLM_IMPORT_ERROR is not None:
            raise RuntimeError(f"Failed to import vLLM: {VLLM_IMPORT_ERROR}")
        raise RuntimeError("vLLM symbols are unavailable in this runtime.")
    return LLM, SamplingParams


def to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}

    if hasattr(value, "model_dump"):
        try:
            dumped = value.model_dump()  # type: ignore[attr-defined]
            return to_jsonable(dumped)
        except Exception:
            pass
    if hasattr(value, "dict"):
        try:
            dumped = value.dict()  # type: ignore[attr-defined]
            return to_jsonable(dumped)
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        return to_jsonable(vars(value))
    return str(value)


def init_runtime(*, runtime: RuntimeRole, model: str, engine_args: JsonDict) -> JsonDict:
    if not isinstance(model, str) or not model:
        raise ValueError(f"Invalid model for runtime {runtime}.")

    start = time.perf_counter()
    llm_cls, _ = require_vllm_symbols()
    llm = llm_cls(model=model, **engine_args)
    duration_ms = int((time.perf_counter() - start) * 1000)
    initialized_at_ms = int(time.time() * 1000)

    STATE.runtimes[runtime] = RuntimeState(
        llm=llm,
        model=model,
        initialized_at_ms=initialized_at_ms,
        engine_args=engine_args,
    )

    return {
        "runtime": runtime,
        "model": model,
        "durationMs": duration_ms,
        "initializedAtMs": initialized_at_ms,
    }


def ensure_initialized(*, runtime: RuntimeRole, auto_init: bool) -> Any:
    runtime_state = STATE.runtimes[runtime]
    if runtime_state.llm is None:
        if not auto_init:
            raise RuntimeError(
                f'Runtime "{runtime}" is not initialized. Send an init request first.'
            )
        init_runtime(runtime=runtime, model=runtime_state.model, engine_args={})
        runtime_state = STATE.runtimes[runtime]
    return runtime_state.llm


def handle_init(detail: Any) -> JsonDict:
    require_vllm_symbols()
    detail_obj: JsonDict = {}
    if detail is None:
        detail_obj = {}
    elif isinstance(detail, dict):
        detail_obj = detail
    else:
        raise ValueError("detail must be an object for init.")

    targets = parse_runtime_targets(detail_obj.get("runtime"))
    global_engine_args = parse_engine_args(
        detail_obj.get("engineArgs"), field_name="detail.engineArgs"
    )
    engine_args_by_runtime = parse_engine_args(
        detail_obj.get("engineArgsByRuntime"),
        field_name="detail.engineArgsByRuntime",
    )
    model_override = detail_obj.get("model")
    model_by_runtime_raw = detail_obj.get("models")
    if model_by_runtime_raw is None:
        model_by_runtime: JsonDict = {}
    elif isinstance(model_by_runtime_raw, dict):
        model_by_runtime = model_by_runtime_raw
    else:
        raise ValueError("detail.models must be an object when provided.")

    if model_override is not None and len(targets) != 1:
        raise ValueError("detail.model can only be used when initializing a single runtime.")

    initialized: list[JsonDict] = []
    for runtime in targets:
        resolved_model = DEFAULT_MODELS[runtime]
        if model_override is not None:
            if not isinstance(model_override, str) or not model_override:
                raise ValueError("detail.model must be a non-empty string when provided.")
            resolved_model = model_override
        runtime_override = model_by_runtime.get(runtime)
        if runtime_override is not None:
            if not isinstance(runtime_override, str) or not runtime_override:
                raise ValueError(f"detail.models.{runtime} must be a non-empty string.")
            resolved_model = runtime_override

        runtime_args = parse_engine_args(
            engine_args_by_runtime.get(runtime),
            field_name=f"detail.engineArgsByRuntime.{runtime}",
        )
        merged_args = dict(global_engine_args)
        merged_args.update(runtime_args)
        initialized.append(
            init_runtime(runtime=runtime, model=resolved_model, engine_args=merged_args)
        )

    return {
        "initializedRuntimes": [row["runtime"] for row in initialized],
        "runtimes": {
            row["runtime"]: {
                "model": row["model"],
                "durationMs": row["durationMs"],
                "initializedAtMs": row["initializedAtMs"],
            }
            for row in initialized
        },
    }


def build_usage(outputs: list[Any]) -> JsonDict:
    prompt_tokens = 0
    completion_tokens = 0
    for row in outputs:
        prompt_ids = getattr(row, "prompt_token_ids", None)
        if isinstance(prompt_ids, list):
            prompt_tokens += len(prompt_ids)
        for candidate in getattr(row, "outputs", []):
            token_ids = getattr(candidate, "token_ids", None)
            if isinstance(token_ids, list):
                completion_tokens += len(token_ids)

    return {
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "totalTokens": prompt_tokens + completion_tokens,
    }


def serialize_outputs(outputs: list[Any]) -> list[JsonDict]:
    rows: list[JsonDict] = []
    for row in outputs:
        request_id = getattr(row, "request_id", None)
        prompt = getattr(row, "prompt", None)
        prompt_token_ids = getattr(row, "prompt_token_ids", None)
        candidates: list[JsonDict] = []

        for candidate in getattr(row, "outputs", []):
            tool_calls = getattr(candidate, "tool_calls", None)
            reasoning = (
                getattr(candidate, "reasoning", None)
                or getattr(candidate, "reasoning_content", None)
                or getattr(candidate, "reasoningContent", None)
            )
            candidates.append(
                {
                    "index": getattr(candidate, "index", None),
                    "text": getattr(candidate, "text", ""),
                    "tokenIds": getattr(candidate, "token_ids", []),
                    "finishReason": getattr(candidate, "finish_reason", None),
                    "stopReason": getattr(candidate, "stop_reason", None),
                    "toolCalls": to_jsonable(tool_calls),
                    "reasoning": to_jsonable(reasoning),
                }
            )

        rows.append(
            {
                "requestId": request_id,
                "prompt": prompt,
                "promptTokenIds": prompt_token_ids,
                "candidates": candidates,
            }
        )
    return rows


def parse_tools(raw: Any) -> list[Any] | None:
    if raw is None:
        return None
    if not isinstance(raw, list):
        raise ValueError("detail.tools must be an array when provided.")
    return raw


def parse_messages(raw: Any) -> list[Any] | None:
    if raw is None:
        return None
    if not isinstance(raw, list) or len(raw) == 0:
        raise ValueError("detail.messages must be a non-empty array when provided.")
    return normalize_chat_messages(raw)


def normalize_content_part(part: Any) -> Any:
    if not isinstance(part, dict):
        return part
    normalized = dict(part)
    part_type = normalized.get("type")
    if not isinstance(part_type, str) or len(part_type) == 0:
        return normalized

    if part_type == "image":
        normalized["type"] = "image_url"
        if "image_url" not in normalized:
            image_url = normalized.get("imageUrl")
            if isinstance(image_url, str) and len(image_url) > 0:
                normalized["image_url"] = {"url": image_url}
    elif part_type == "video":
        normalized["type"] = "video_url"
        if "video_url" not in normalized:
            video_url = normalized.get("videoUrl")
            if isinstance(video_url, str) and len(video_url) > 0:
                normalized["video_url"] = {"url": video_url}
    elif part_type == "audio":
        normalized["type"] = "audio_url"
        if "audio_url" not in normalized:
            audio_url = normalized.get("audioUrl")
            if isinstance(audio_url, str) and len(audio_url) > 0:
                normalized["audio_url"] = {"url": audio_url}

    image_url_obj = normalized.get("image_url")
    if isinstance(image_url_obj, str):
        normalized["image_url"] = {"url": image_url_obj}
    video_url_obj = normalized.get("video_url")
    if isinstance(video_url_obj, str):
        normalized["video_url"] = {"url": video_url_obj}
    audio_url_obj = normalized.get("audio_url")
    if isinstance(audio_url_obj, str):
        normalized["audio_url"] = {"url": audio_url_obj}

    return normalized


def normalize_chat_message(message: Any) -> Any:
    if not isinstance(message, dict):
        return message
    normalized = dict(message)
    if "tool_call_id" not in normalized:
        tool_call_id = normalized.get("toolCallId")
        if isinstance(tool_call_id, str) and len(tool_call_id) > 0:
            normalized["tool_call_id"] = tool_call_id

    content = normalized.get("content")
    if isinstance(content, list):
        normalized["content"] = [normalize_content_part(part) for part in content]
    return normalized


def normalize_chat_messages(messages: list[Any]) -> list[Any]:
    return [normalize_chat_message(message) for message in messages]


def resolve_reasoning_mode(detail: JsonDict) -> tuple[bool | None, str]:
    reasoning_mode_raw = detail.get("reasoningMode")
    thinking = detail.get("thinking")

    if thinking is not None and not isinstance(thinking, bool):
        raise ValueError("detail.thinking must be a boolean when provided.")

    if reasoning_mode_raw is None:
        return (thinking if isinstance(thinking, bool) else None, "default")

    if not isinstance(reasoning_mode_raw, str) or not reasoning_mode_raw:
        raise ValueError("detail.reasoningMode must be a non-empty string when provided.")
    if reasoning_mode_raw not in {"default", "thinking", "no_thinking"}:
        raise ValueError(
            "detail.reasoningMode must be one of: default, thinking, no_thinking."
        )

    if reasoning_mode_raw == "thinking":
        return (True, reasoning_mode_raw)
    if reasoning_mode_raw == "no_thinking":
        return (False, reasoning_mode_raw)
    return (thinking if isinstance(thinking, bool) else None, reasoning_mode_raw)


def resolve_infer_input(detail: JsonDict) -> tuple[InferMode, Any]:
    messages = parse_messages(detail.get("messages"))
    if messages is not None:
        return (INFER_MODE_CHAT, messages)

    prompt = detail.get("prompt")
    prompts = detail.get("prompts")
    inputs = detail.get("inputs")

    if inputs is not None:
        if not isinstance(inputs, list) or len(inputs) == 0:
            raise ValueError("detail.inputs must be a non-empty array when provided.")
        return (INFER_MODE_GENERATE, inputs)

    if isinstance(prompt, str) and prompt:
        return (INFER_MODE_GENERATE, prompt)
    if isinstance(prompts, list) and prompts and all(
        isinstance(item, str) and item for item in prompts
    ):
        return (INFER_MODE_GENERATE, prompts)

    raise ValueError(
        "infer requires one of: detail.messages, detail.inputs, "
        "detail.prompt (string), or detail.prompts (non-empty string array)."
    )


def handle_infer(detail: Any) -> JsonDict:
    if not isinstance(detail, dict):
        raise ValueError("detail must be an object for infer.")
    runtime_raw = detail.get("runtime")
    runtime = parse_runtime(runtime_raw, field_name="detail.runtime")
    thinking, reasoning_mode = resolve_reasoning_mode(detail)
    mode, request_input = resolve_infer_input(detail)
    tools = parse_tools(detail.get("tools"))
    auto_init = parse_optional_bool(
        detail.get("autoInit"), field_name="detail.autoInit", default=True
    )
    llm = ensure_initialized(runtime=runtime, auto_init=auto_init)

    sampling = parse_sampling_params(detail.get("sampling"))

    use_tqdm = parse_optional_bool(
        detail.get("useTqdm"), field_name="detail.useTqdm", default=False
    )
    chat_template_kwargs = parse_engine_args(
        detail.get("chatTemplateKwargs"),
        field_name="detail.chatTemplateKwargs",
    )
    if thinking is not None:
        chat_template_kwargs["enable_thinking"] = thinking

    start = time.perf_counter()
    if mode == INFER_MODE_CHAT:
        chat_kwargs: JsonDict = {
            "sampling_params": sampling,
            "use_tqdm": use_tqdm,
        }
        if tools is not None:
            chat_kwargs["tools"] = tools
        if chat_template_kwargs:
            chat_kwargs["chat_template_kwargs"] = chat_template_kwargs
        outputs = llm.chat(request_input, **chat_kwargs)
    else:
        outputs = llm.generate(request_input, sampling_params=sampling, use_tqdm=use_tqdm)
    duration_ms = int((time.perf_counter() - start) * 1000)

    output_rows = serialize_outputs(outputs)
    usage = build_usage(outputs)
    runtime_state = STATE.runtimes[runtime]

    return {
        "runtime": runtime,
        "model": runtime_state.model,
        "mode": mode,
        "reasoningMode": reasoning_mode,
        "thinking": thinking,
        "durationMs": duration_ms,
        "outputs": output_rows,
        "usage": usage,
    }


def handle_health() -> JsonDict:
    runtimes: JsonDict = {}
    for runtime in SUPPORTED_RUNTIMES:
        runtime_state = STATE.runtimes[runtime]
        runtimes[runtime] = {
            "initialized": runtime_state.llm is not None,
            "model": runtime_state.model,
            "initializedAtMs": runtime_state.initialized_at_ms,
        }

    return {
        "runtimes": runtimes,
    }


def handle_shutdown(detail: Any) -> JsonDict:
    detail_obj: JsonDict = {}
    if detail is None:
        detail_obj = {}
    elif isinstance(detail, dict):
        detail_obj = detail
    else:
        raise ValueError("detail must be an object for shutdown.")

    targets = parse_runtime_targets(detail_obj.get("runtime"))
    for runtime in targets:
        runtime_state = STATE.runtimes[runtime]
        runtime_state.llm = None
        runtime_state.initialized_at_ms = None
        runtime_state.engine_args = None

    shutting_down_process = detail_obj.get("exitProcess", True)
    if not isinstance(shutting_down_process, bool):
        raise ValueError("detail.exitProcess must be a boolean when provided.")

    return {
        "releasedRuntimes": targets,
        "exitProcess": shutting_down_process,
    }


def main() -> int:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id: str | None = None
        request_type: str | None = None

        try:
            envelope = json.loads(line)
            if not isinstance(envelope, dict):
                raise ValueError("Request envelope must be a JSON object.")

            request_id_raw = envelope.get("id")
            request_type_raw = envelope.get("type")
            detail = envelope.get("detail")

            request_id = request_id_raw if isinstance(request_id_raw, str) else None
            if not isinstance(request_type_raw, str) or not request_type_raw:
                raise ValueError("Request envelope requires non-empty string field: type.")
            request_type = request_type_raw

            if request_type == "init":
                result = handle_init(detail)
                write_response(request_id=request_id, ok=True, detail=result)
            elif request_type == "infer":
                result = handle_infer(detail)
                write_response(request_id=request_id, ok=True, detail=result)
            elif request_type == "health":
                result = handle_health()
                write_response(request_id=request_id, ok=True, detail=result)
            elif request_type == "shutdown":
                result = handle_shutdown(detail)
                write_response(request_id=request_id, ok=True, detail=result)
                if result.get("exitProcess"):
                    return 0
            else:
                fail(
                    request_id=request_id,
                    code="UNKNOWN_REQUEST_TYPE",
                    message=f"Unsupported request type: {request_type}",
                )
        except Exception as error:
            message = str(error) if str(error) else error.__class__.__name__
            fail(
                request_id=request_id,
                code="REQUEST_ERROR",
                message=message,
                include_traceback=True,
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
