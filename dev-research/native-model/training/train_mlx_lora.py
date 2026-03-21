from __future__ import annotations

import argparse
import json
import math
import os
import random
import subprocess
import sys
from pathlib import Path
from typing import Any


def summarize_auth_env() -> dict[str, bool]:
    return {
        "HF_TOKEN": bool(os.environ.get("HF_TOKEN")),
        "HUGGING_FACE_HUB_TOKEN": bool(os.environ.get("HUGGING_FACE_HUB_TOKEN")),
        "HUGGINGFACE_HUB_TOKEN": bool(os.environ.get("HUGGINGFACE_HUB_TOKEN")),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare and run the first MLX LoRA/SFT tuning pass.")
    parser.add_argument(
        "--input",
        default=os.environ.get("TRAIN_DATASET_PATH"),
        help="Path to chat-format SFT dataset JSONL produced by native-model:train.",
    )
    parser.add_argument(
        "--output-dir",
        default=os.environ.get("TRAIN_OUTPUT_DIR"),
        help="Output directory for split dataset, config, and adapters.",
    )
    parser.add_argument(
        "--base-model",
        default=os.environ.get("BASE_MODEL", "tiiuae/Falcon-H1-7B-Base"),
        help="Base model path or Hugging Face repo.",
    )
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--iters", type=int, default=60)
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--num-layers", type=int, default=8)
    parser.add_argument("--fine-tune-type", default="lora", choices=["lora", "dora", "full"])
    parser.add_argument("--max-seq-length", type=int, default=2048)
    parser.add_argument("--steps-per-report", type=int, default=5)
    parser.add_argument("--steps-per-eval", type=int, default=20)
    parser.add_argument("--save-every", type=int, default=20)
    parser.add_argument("--grad-checkpoint", action="store_true")
    parser.add_argument("--mask-prompt", action="store_true")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--run", action="store_true", help="Actually invoke mlx_lm lora after preparing files.")
    return parser.parse_args()


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    lines = [line for line in path.read_text().splitlines() if line.strip()]
    if not lines:
        raise ValueError(f"Dataset is empty: {path}")
    return [json.loads(line) for line in lines]


def split_examples(examples: list[dict[str, Any]], seed: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    shuffled = examples[:]
    random.Random(seed).shuffle(shuffled)
    if len(shuffled) < 2:
        return shuffled, []

    valid_count = max(1, math.floor(len(shuffled) * 0.2))
    if valid_count >= len(shuffled):
        valid_count = 1

    valid = shuffled[:valid_count]
    train = shuffled[valid_count:]
    return train, valid


def write_jsonl(path: Path, items: list[dict[str, Any]]) -> None:
    if not items:
        return
    path.write_text("".join(f"{json.dumps(item)}\n" for item in items))


def build_training_command(args: argparse.Namespace, dataset_dir: Path, adapter_path: Path) -> list[str]:
    command = [
        sys.executable,
        "-m",
        "mlx_lm",
        "lora",
        "--train",
        "--model",
        args.base_model,
        "--data",
        str(dataset_dir),
        "--adapter-path",
        str(adapter_path),
        "--batch-size",
        str(args.batch_size),
        "--iters",
        str(args.iters),
        "--learning-rate",
        str(args.learning_rate),
        "--num-layers",
        str(args.num_layers),
        "--fine-tune-type",
        args.fine_tune_type,
        "--max-seq-length",
        str(args.max_seq_length),
        "--steps-per-report",
        str(args.steps_per_report),
        "--steps-per-eval",
        str(args.steps_per_eval),
        "--save-every",
        str(args.save_every),
        "--seed",
        str(args.seed),
    ]

    if args.grad_checkpoint:
        command.append("--grad-checkpoint")
    if args.mask_prompt:
        command.append("--mask-prompt")

    return command


def main() -> None:
    args = parse_args()
    if not args.input:
        raise SystemExit("Missing --input or TRAIN_DATASET_PATH")
    if not args.output_dir:
        raise SystemExit("Missing --output-dir or TRAIN_OUTPUT_DIR")

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    dataset_dir = output_dir / "mlx-data"
    adapter_path = output_dir / "adapters"
    dataset_dir.mkdir(parents=True, exist_ok=True)
    adapter_path.mkdir(parents=True, exist_ok=True)

    examples = load_jsonl(input_path)
    train_examples, valid_examples = split_examples(examples, args.seed)

    write_jsonl(dataset_dir / "train.jsonl", train_examples)
    write_jsonl(dataset_dir / "valid.jsonl", valid_examples)

    manifest = {
        "input": str(input_path),
        "dataset_dir": str(dataset_dir),
        "train_count": len(train_examples),
        "valid_count": len(valid_examples),
        "base_model": args.base_model,
        "fine_tune_type": args.fine_tune_type,
        "batch_size": args.batch_size,
        "iters": args.iters,
        "learning_rate": args.learning_rate,
        "num_layers": args.num_layers,
        "max_seq_length": args.max_seq_length,
        "adapter_path": str(adapter_path),
        "seed": args.seed,
    }
    (output_dir / "mlx-train-manifest.json").write_text(json.dumps(manifest, indent=2))

    command = build_training_command(args, dataset_dir, adapter_path)

    print("# MLX LoRA Training Prep")
    print()
    print(f"- Input dataset: {input_path}")
    print(f"- Train split: {dataset_dir / 'train.jsonl'} ({len(train_examples)} examples)")
    print(f"- Valid split: {dataset_dir / 'valid.jsonl'} ({len(valid_examples)} examples)")
    print(f"- Manifest: {output_dir / 'mlx-train-manifest.json'}")
    print(f"- Adapter output: {adapter_path}")
    print(f"- HF auth env: {summarize_auth_env()}")
    print()
    print("Command:")
    print(" ".join(command))

    if args.run:
        child_env = os.environ.copy()
        print(
            "Launching mlx_lm with auth env:",
            {
                "HF_TOKEN": bool(child_env.get("HF_TOKEN")),
                "HUGGING_FACE_HUB_TOKEN": bool(child_env.get("HUGGING_FACE_HUB_TOKEN")),
                "HUGGINGFACE_HUB_TOKEN": bool(child_env.get("HUGGINGFACE_HUB_TOKEN")),
            },
        )
        subprocess.run(command, check=True, env=child_env)


if __name__ == "__main__":
    main()
