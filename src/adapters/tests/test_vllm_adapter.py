from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest


def load_vllm_adapter_module() -> ModuleType:
    adapter_path = Path(__file__).resolve().parents[3] / "src" / "adapters" / "vllm.py"
    spec = importlib.util.spec_from_file_location("vllm_adapter_test_module", adapter_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load vLLM adapter module spec.")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_parse_sampling_params_raises_when_vllm_symbols_are_unavailable() -> None:
    module = load_vllm_adapter_module()
    module.LLM = None
    module.SamplingParams = None
    module.VLLM_IMPORT_ERROR = RuntimeError("missing-vllm")

    with pytest.raises(RuntimeError, match="Failed to import vLLM"):
        module.parse_sampling_params(None)


def test_init_runtime_raises_when_vllm_symbols_are_unavailable() -> None:
    module = load_vllm_adapter_module()
    module.LLM = None
    module.SamplingParams = None
    module.VLLM_IMPORT_ERROR = RuntimeError("missing-vllm")

    with pytest.raises(RuntimeError, match="Failed to import vLLM"):
        module.init_runtime(runtime="analyst", model="test-model", engine_args={})


def test_handle_infer_rejects_non_boolean_auto_init() -> None:
    module = load_vllm_adapter_module()

    with pytest.raises(ValueError, match="detail.autoInit must be a boolean"):
        module.handle_infer({"runtime": "analyst", "prompt": "hello", "autoInit": "false"})


def test_handle_infer_rejects_non_boolean_use_tqdm() -> None:
    module = load_vllm_adapter_module()

    class FakeSamplingParams:
        def __init__(self, **_: object) -> None:
            pass

    class FakeLlm:
        def generate(self, *_: object, **__: object) -> list[object]:
            return []

    module.LLM = object
    module.SamplingParams = FakeSamplingParams
    module.VLLM_IMPORT_ERROR = None
    module.STATE.runtimes["analyst"].llm = FakeLlm()

    with pytest.raises(ValueError, match="detail.useTqdm must be a boolean"):
        module.handle_infer(
            {
                "runtime": "analyst",
                "prompt": "hello",
                "autoInit": False,
                "useTqdm": "no",
            }
        )


def test_handle_infer_supports_chat_multimodal_tools_and_thinking() -> None:
    module = load_vllm_adapter_module()

    class FakeSamplingParams:
        def __init__(self, **_: object) -> None:
            pass

    class FakeCandidate:
        def __init__(self) -> None:
            self.index = 0
            self.text = "tool call response"
            self.token_ids = [1, 2, 3]
            self.finish_reason = "tool_calls"
            self.stop_reason = None
            self.tool_calls = [
                {
                    "id": "call-1",
                    "type": "function",
                    "function": {"name": "read_file", "arguments": '{"path":"README.md"}'},
                }
            ]

    class FakeRow:
        def __init__(self) -> None:
            self.request_id = "req-1"
            self.prompt = None
            self.prompt_token_ids = [10, 11]
            self.outputs = [FakeCandidate()]

    class FakeLlm:
        def __init__(self) -> None:
            self.captured_messages = None
            self.captured_kwargs = None

        def chat(self, messages: object, **kwargs: object) -> list[object]:
            self.captured_messages = messages
            self.captured_kwargs = kwargs
            return [FakeRow()]

    fake_llm = FakeLlm()
    module.LLM = object
    module.SamplingParams = FakeSamplingParams
    module.VLLM_IMPORT_ERROR = None
    module.STATE.runtimes["analyst"].llm = fake_llm
    module.STATE.runtimes["analyst"].model = "google/gemma-4-31B-it"

    result = module.handle_infer(
        {
            "runtime": "analyst",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is in this media?"},
                        {"type": "image_url", "image_url": {"url": "https://example.com/img.png"}},
                        {"type": "video_url", "video_url": {"url": "https://example.com/video.mp4"}},
                    ],
                }
            ],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "read_file",
                        "description": "Read a file by path",
                        "parameters": {
                            "type": "object",
                            "properties": {"path": {"type": "string"}},
                        },
                    },
                }
            ],
            "thinking": True,
            "useTqdm": False,
            "autoInit": False,
        }
    )

    assert result["mode"] == "chat"
    assert result["reasoningMode"] == "default"
    assert result["thinking"] is True
    assert fake_llm.captured_messages is not None
    assert fake_llm.captured_kwargs is not None
    assert fake_llm.captured_kwargs["tools"][0]["function"]["name"] == "read_file"
    assert fake_llm.captured_kwargs["chat_template_kwargs"]["enable_thinking"] is True
    assert result["outputs"][0]["candidates"][0]["toolCalls"][0]["id"] == "call-1"


def test_handle_infer_normalizes_legacy_message_shapes_for_chat_contract() -> None:
    module = load_vllm_adapter_module()

    class FakeSamplingParams:
        def __init__(self, **_: object) -> None:
            pass

    class FakeCandidate:
        def __init__(self) -> None:
            self.index = 0
            self.text = "ok"
            self.token_ids = []
            self.finish_reason = "stop"
            self.stop_reason = None
            self.tool_calls = None

    class FakeRow:
        def __init__(self) -> None:
            self.request_id = "req-legacy"
            self.prompt = None
            self.prompt_token_ids = []
            self.outputs = [FakeCandidate()]

    class FakeLlm:
        def __init__(self) -> None:
            self.captured_messages = None

        def chat(self, messages: object, **_: object) -> list[object]:
            self.captured_messages = messages
            return [FakeRow()]

    fake_llm = FakeLlm()
    module.LLM = object
    module.SamplingParams = FakeSamplingParams
    module.VLLM_IMPORT_ERROR = None
    module.STATE.runtimes["analyst"].llm = fake_llm

    module.handle_infer(
        {
            "runtime": "analyst",
            "messages": [
                {
                    "role": "tool",
                    "toolCallId": "call-legacy",
                    "name": "read_file",
                    "content": [
                        {"type": "image", "imageUrl": "https://example.com/img.png"},
                    ],
                }
            ],
            "autoInit": False,
        }
    )

    assert fake_llm.captured_messages is not None
    message = fake_llm.captured_messages[0]
    assert message["tool_call_id"] == "call-legacy"
    assert message["content"][0]["type"] == "image_url"
    assert message["content"][0]["image_url"]["url"] == "https://example.com/img.png"


def test_handle_infer_rejects_invalid_reasoning_mode() -> None:
    module = load_vllm_adapter_module()

    with pytest.raises(ValueError, match="detail.reasoningMode must be one of"):
        module.handle_infer(
            {
                "runtime": "analyst",
                "prompt": "hello",
                "reasoningMode": "aggressive",
            }
        )
