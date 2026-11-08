"""Reproduce the article's three completions with the pinned Zehn-135M release.

python generate_examples.py --output generation-examples.json
python generate_examples.py --model /path/to/local/export --output generation-examples.json
"""

import argparse
import hashlib
import json
import platform
from pathlib import Path

import torch
import transformers
from huggingface_hub import snapshot_download
from transformers import AutoModelForCausalLM, AutoTokenizer


MODEL_ID = "GrowBitLabs/zehn-135m"
REVISION = "f77ddf738caac00c06d10ac5534bb8d4bdfc44fa"
EXPECTED_HASHES = {
    "model.safetensors": "5a2015967ab37d2887cc4ab0248bc251abeb73c775a55714458d460d122db205",
    "config.json": "47778b75d3e5e7d1b9941c8e59e9569102f4b881dce689d7c1ccde672e270dd6",
    "configuration_zehn.py": "83cd6dac9f238a45e1dd9044d67fdd255b0c9ead0a4a586768dfd76dabb55dd5",
    "modeling_zehn.py": "9e9a69b44dff01b3fe865355ae840132002b9017769c31e32cc712c4a3f389c9",
    "tokenization_zehn.py": "845b5b8a8f1201d53f87e55c0af67ba777224ee39342faea96068c1147319783",
    "tokenizer.model": "cb43661ee8d019cd8d1d2a404cf12bfedd64ebe7b50cec4dd9167356b5a7ca41",
    "tokenizer_config.json": "826f8a27273c220a3027d18300393d01b6c786e380b494418ee763048089b8ab",
    "generation_config.json": "906217ff327c64043e8634bc8edcf357eacd29c4059f25365005e6b8d4ea736d",
}
PROMPTS = [
    "The future of small language models is",
    "Once upon a time, in a small village,",
    "The capital of France is",
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=MODEL_ID)
    parser.add_argument("--output", type=Path, default=Path("generation-examples.json"))
    args = parser.parse_args()

    if Path(args.model).is_dir():
        export = Path(args.model).resolve()
    else:
        export = Path(snapshot_download(
            repo_id=args.model,
            revision=REVISION,
            allow_patterns=list(EXPECTED_HASHES),
        ))
    hashes = {}
    for name, expected in EXPECTED_HASHES.items():
        hashes[name] = hashlib.sha256((export / name).read_bytes()).hexdigest()
        if hashes[name] != expected:
            raise ValueError(f"{name} does not match the pinned release")

    torch.set_num_threads(8)
    torch.manual_seed(42)
    tokenizer = AutoTokenizer.from_pretrained(
        export, trust_remote_code=True, add_eos_token=False, local_files_only=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        export, trust_remote_code=True, torch_dtype=torch.float32, local_files_only=True,
    ).to("cpu").eval()
    settings = dict(
        max_new_tokens=32,
        do_sample=False,
        num_beams=1,
        repetition_penalty=1.1,
        use_cache=False,
        pad_token_id=tokenizer.eos_token_id,
        eos_token_id=tokenizer.eos_token_id,
    )
    results = []
    for prompt in PROMPTS:
        inputs = tokenizer(prompt, return_tensors="pt")
        prompt_length = inputs["input_ids"].shape[1]
        if prompt_length + settings["max_new_tokens"] > 1024:
            raise ValueError("Prompt and completion exceed the training sequence length")
        with torch.inference_mode():
            output = model.generate(**inputs, **settings)
        generated_ids = output[0, prompt_length:].tolist()
        result = {
            "prompt": prompt,
            "prompt_tokens": prompt_length,
            "generated_token_ids": generated_ids,
            "completion": tokenizer.decode(generated_ids, skip_special_tokens=True),
            "full_text": tokenizer.decode(output[0], skip_special_tokens=True),
        }
        results.append(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)

    evidence = {
        "model_id": MODEL_ID,
        "revision": REVISION,
        "checkpoint_step": 32000,
        "sha256": hashes,
        "environment": {
            "python": platform.python_version(),
            "torch": torch.__version__,
            "transformers": transformers.__version__,
            "device": "cpu",
            "dtype": "float32 (converted from FP16 export)",
            "threads": torch.get_num_threads(),
            "seed": 42,
        },
        "tokenizer": {"add_bos_token": True, "add_eos_token": False},
        "generation": settings,
        "selection": "First greedy completion for each of the three fixed prompts; no retries or editing.",
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
