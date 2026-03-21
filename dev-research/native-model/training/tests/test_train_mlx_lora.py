from pathlib import Path

from train_mlx_lora import build_training_command, split_examples, write_jsonl


def test_split_examples_keeps_at_least_one_validation_example() -> None:
    examples = [{"messages": [{"role": "user", "content": "a"}]} for _ in range(5)]

    train, valid = split_examples(examples, seed=7)

    assert len(train) == 4
    assert len(valid) == 1


def test_build_training_command_uses_expected_mlx_cli_shape(tmp_path: Path) -> None:
    class Args:
        base_model = "tiiuae/Falcon-H1-7B-Base"
        batch_size = 1
        iters = 60
        learning_rate = 1e-5
        num_layers = 8
        fine_tune_type = "lora"
        max_seq_length = 2048
        steps_per_report = 5
        steps_per_eval = 20
        save_every = 20
        seed = 7
        grad_checkpoint = False
        mask_prompt = False

    command = build_training_command(Args(), tmp_path / "mlx-data", tmp_path / "adapters")

    assert command[1:4] == ["-m", "mlx_lm", "lora"]
    assert "--train" in command
    assert "--model" in command
    assert "--data" in command
    assert "--adapter-path" in command


def test_write_jsonl_writes_one_object_per_line(tmp_path: Path) -> None:
    path = tmp_path / "train.jsonl"
    write_jsonl(path, [{"messages": [{"role": "user", "content": "hello"}]}])
    assert path.read_text().count("\n") == 1
