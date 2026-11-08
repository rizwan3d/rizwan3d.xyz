---
title: "How I Built a 135M-Parameter Language Model with C# and Python"
slug: "build-135m-language-model-csharp-python"
created: "2026-11-09"
updated: "2026-11-09"
category: "software-engineering"
description: "Learn how I built Zehn-135M using C#, TorchSharp, and Python, from hybrid DeltaNet architecture and training to inference and model export."
author: "Muhammad Rizwan"
tags: "ai, language-models, zehn, csharp, dotnet, torchsharp, python, machine-learning"
featuredImageCreditUrl: "https://unsplash.com/@boliviainteligente"
featuredImageCredit: "Photo by BoliviaInteligente on Unsplash"
featuredImageAlt: "Glowing green computer chip on a dark circuit board representing artificial intelligence and machine learning"
featuredImage: "https://images.unsplash.com/photo-1678995637406-1ca9bdf03817"
featured: true
---

## Introduction: Why build a language model in C#?

I built **Zehn-135M** at GrowBitLabs to understand the full language-model pipeline in code I could inspect: tokenization, recurrent state updates, attention, expert routing, optimization, checkpoint export, and text generation. I also wanted to work through that pipeline in the ecosystem I use for applications: **C# and .NET**.

TorchSharp gave me access to LibTorch tensors and automatic differentiation from C#. Python handled data preparation and tokenizer training, and a separate PyTorch implementation made the exported weights accessible through Hugging Face Transformers. This let me keep the native model and training loop in C# while providing a familiar Python inference path.

The result is a decoder-only **base language model** with **134,997,792 parameters**. Its job is next-token prediction. It continues unfinished passages; this release has no instruction tuning or chat template.

The checkpoint is available as [GrowBitLabs/zehn-135m on Hugging Face](https://huggingface.co/GrowBitLabs/zehn-135m). This article covers optimizer **step 32,000**, pinned to release revision `f77ddf738caac00c06d10ac5534bb8d4bdfc44fa`. It includes measured losses and actual completions, including failures.

## Zehn-135M at a glance: Parameters, architecture, training and results

| Component | Step 32,000 checkpoint |
|---|---|
| Total parameters | 134,997,792, including all experts |
| Decoder layers | 16: 12 gated DeltaNet and 4 grouped-query attention |
| Hidden size | 768 |
| Tokenizer | SentencePiece BPE, 16,384 tokens |
| Attention heads | 12 query heads and 4 key/value heads |
| Feed-forward stage | 4 routed SwiGLU experts, top-2 selection, plus 1 shared expert per layer |
| Training sequence length | 1,024 tokens |
| Training schedule | 32,000 optimizer steps; effective batch of 32 sequences |
| Processed training-token positions | 1,048,576,000, including repeated corpus exposure |
| Native implementation | C#, .NET 10, TorchSharp 0.107.0 |
| Training / exported projections | BF16 compute / FP16 weights |
| Held-out mixture perplexity | 19.55 on 21,152 tokens |
| WikiText-103 validation perplexity | 87.74 on 57,189 tokens, from the matching local training log |

Both validation results are capped at **64 batches per source**. They measure next-token prediction on small slices, with the methodology and evidence explained below. They don't establish general task accuracy.

## Architecture: DeltaNet, attention and MoE

The 16 decoder layers follow a repeating pattern: three gated DeltaNet layers, then one attention layer. Attention appears at layers **4, 8, 12, and 16**. Every layer also contains normalization, residual connections, and a mixture-of-experts feed-forward stage.

![Zehn-135M architecture showing all 16 layers: DeltaNet at layers 1–3, 5–7, 9–11 and 13–15; attention at layers 4, 8, 12 and 16; followed by final normalization and a tied output projection.](/assets/images/zehn-135m-architecture.svg)

The diagram follows the released layer configuration. The output projection shares weights with the input embeddings.

### Gated DeltaNet: carrying a recurrent state

Each DeltaNet head maintains a state matrix. For each token, the layer decays the previous state, applies a correction based on the current key and value, and reads the updated state using the query. My implementation also applies short causal convolutions to the query, key, and value projections and uses an output gate.

This gives the model a recurrent way to carry information through a sequence. The four attention layers supplement that state with direct attention over earlier token positions. I haven't run an ablation against an otherwise matched attention-only model, so the hybrid design is an architectural choice here, without a measured quality or speed advantage.

### Grouped-query attention

The attention layers use 12 query heads and 4 key/value heads: three query heads share each key/value head. Rotary position embeddings provide position information, and a causal mask prevents access to future tokens.

Sharing key/value heads reduces the key/value projection dimensions and cached key/value storage relative to using 12 independent pairs. Actual throughput still depends on kernels, precision, sequence length, and cache support.

### How expert routing works

For each token, the router produces four scores and selects the largest two. With normalized top-2 routing enabled, a softmax over those selected scores supplies their weights. The layer sums the weighted routed outputs and the output of one shared expert, then adds the residual connection.

![Mixture-of-experts routing: a normalized token vector feeds a four-score router and a shared expert; two selected SwiGLU experts contribute weighted outputs, which are added to the shared expert output.](/assets/images/zehn-135m-routing.svg)

Experts 1 and 3 are an illustrative selection in the diagram; the selected pair changes with the token. Each expert is a SwiGLU network with intermediate size 423. Training adds a Switch-style load-balancing loss with weight `0.01` and a router z-loss with weight `0.001`. Training capacity limits can drop excess routes; evaluation and decoding retain the selected routes without capacity dropping.

The **135M** name counts every expert. Top-2 selection changes the work performed for a token, while all four routed experts still occupy checkpoint and memory space.

## Implementation: TorchSharp, .NET and Python

The native implementation targets .NET 10 and uses TorchSharp to construct the network and train through LibTorch. The source checkout has four main projects:

```text
src/
  Zehn/          Layers, tokenization, training, and generation
  Zehn.Cli/      Training, evaluation, and inference commands
  Zehn.Api/      ASP.NET Core inference service
  Zehn.Convert/  Checkpoint export tools
```

Tensor lifetime was an important implementation detail. TorchSharp objects wrap native tensor memory, so I use explicit disposal scopes. Managed garbage collection alone doesn't describe when that native memory is released.

Python handles corpus preparation and SentencePiece tokenizer training. The Transformers export includes custom `configuration_zehn.py`, `modeling_zehn.py`, and `tokenization_zehn.py` files. Those classes reconstruct the architecture and tokenizer around the exported weights.

The two inference implementations currently differ in state reuse. Native C# decoding keeps DeltaNet state and attention key/value state between tokens. The released Python implementation returns no reusable `past_key_values`, so it processes the growing prefix again for each generated token. I use `use_cache=False` with that export. A fair speed comparison would need matched hardware, precision, and sequence lengths; I haven't published one here.

## Training: Dataset, optimizer, compute and challenges

### Data and the training budget

I prepared approximately **1.2 GB of text** from [HuggingFaceTB/smollm-corpus](https://huggingface.co/datasets/HuggingFaceTB/smollm-corpus/tree/3ba9d605774198c5868892d7a8deda78031a781f), with a 70% FineWeb-Edu-Dedup and 30% Cosmopedia v2 allocation by text bytes. The preparation manifest records source revision `3ba9d605774198c5868892d7a8deda78031a781f`, seed 42, and a separate approximately 10 MB validation split.

The training token-shard manifest records **268,444,137 tokens across 735,831 documents** using the 16,384-token tokenizer. These shard counts are the relevant input totals for this run; the source mixture percentages aren't measured token percentages.

I used one CUDA worker, microbatches of one sequence, 32 gradient accumulation steps, and 1,024-token sequences:

```python
optimizer_steps = 32_000
microbatch_size = 1
gradient_accumulation_steps = 32
sequence_length = 1_024

effective_batch = microbatch_size * gradient_accumulation_steps
processed_positions = optimizer_steps * effective_batch * sequence_length

print(effective_batch)       # 32 sequences per optimizer update
print(processed_positions)  # 1,048,576,000 token positions
```

That is about **3.91 times the corpus token count** in processed positions. Sampling revisits documents, so this ratio isn't a count of complete, uniformly covered epochs or unique training tokens.

### Optimizer and runtime

| Setting | Recorded value |
|---|---|
| Optimizer | AdamW, betas `(0.9, 0.95)`, epsilon `1e-8` |
| Peak / minimum learning rate | `2e-4` / `1e-5` |
| Warmup | 1,000 optimizer steps |
| Weight decay | `0.1` |
| Gradient clipping | `1.0` |
| Seed | `42` |
| Projection compute | BF16 during training |
| Validation interval | Every 2,000 steps |
| Runtime | Windows x64, TorchSharp 0.107.0, CUDA 12.8 backend |

The [released training configuration](https://huggingface.co/GrowBitLabs/zehn-135m/blob/f77ddf738caac00c06d10ac5534bb8d4bdfc44fa/metadata/training_config.json) contains the full settings. The run was resumed across several sessions. Its metadata doesn't identify the GPU model, and I don't have a verified total GPU-hour or cost figure to report. The configured temperature controller pauses at 82°C and resumes at 70°C; that setting alone doesn't establish how much time any session spent paused.

### Recorded training and validation progression

![Recorded Zehn-135M training cross-entropy and two validation curves over 32,000 optimizer steps; mixture loss improves while WikiText validation reaches its lowest logged loss at step 12,000 and later worsens.](/assets/images/zehn-135m-training-loss.svg)

This chart uses **1,317 recorded training observations** and 16 validation observations per source from `logs.log`. It has no smoothing. Lines connect observations; they don't represent additional measurements. Where resumed sessions logged the same training step more than once, I retained the last observation. The plotted console values are rounded to four decimal places.

| Optimizer step | Training cross-entropy | Held-out mixture cross-entropy | WikiText-103 cross-entropy |
|---|---:|---:|---:|
| 1 | 9.8532 | — | — |
| 2,000 | 4.1175 | 4.0010 | 4.9196 |
| 8,000 | 3.2449 | 3.2826 | 4.2661 |
| 12,000 | 3.1962 | 3.1639 | 4.0556 |
| 16,000 | 2.9326 | 3.0874 | 4.2448 |
| 24,000 | 2.6981 | 3.0057 | 4.3826 |
| 32,000 | 2.7508 | 2.9731 | 4.4743 |

The chart separates prediction cross-entropy from the logged total training `loss`, which also includes router auxiliary terms. Download the [training observations](/assets/data/zehn-135m/training-loss.csv) and [validation progression](/assets/data/zehn-135m/validation-progression.csv) for the underlying numbers.

The held-out mixture keeps improving slowly, but WikiText reaches its lowest logged cross-entropy at step 12,000 and worsens afterward. That is consistent with increasing specialization to the training mixture; these small slices don't establish the cause. The best-checkpoint selector uses the first validation source, the mixture, which explains why step 32,000 was retained despite worse WikiText performance than the earlier checkpoint.

## Evaluation: Metrics, actual examples and limitations

### What the validation measured

The native evaluator uses the same SentencePiece tokenizer as training, including document boundary tokens. It walks documents in stored order, creates next-token input/target pairs in windows of at most **1,024 target tokens**, and starts each window without context from the previous window. It evaluates in `model.eval()` with gradients disabled.

For this run, batch size was one and evaluation stopped after the **first 64 batches of each source**. These are deterministic prefixes, not random samples or full-corpus evaluations. Short documents and final windows explain why 64 batches contain fewer than 65,536 scored tokens.

The evaluator ignores targets marked `-100`, multiplies each batch's mean prediction cross-entropy by its scored-token count, and divides the accumulated loss by the total count. Perplexity is the exponential of that token-weighted cross-entropy:

```python
import math

cross_entropy = sum(batch_ce * scored_tokens for batch_ce, scored_tokens in batches) / total_scored_tokens
perplexity = math.exp(cross_entropy)
```

| Source at step 32,000 | Cross-entropy, nats/token | Perplexity | Scored tokens | Batches |
|---|---:|---:|---:|---:|
| Held-out training mixture | 2.9731 | 19.55 | 21,152 | 64 |
| WikiText-103 validation | 4.4743 | 87.74 | 57,189 | 64 |

The mixture result is in the [released validation metadata](https://huggingface.co/GrowBitLabs/zehn-135m/blob/f77ddf738caac00c06d10ac5534bb8d4bdfc44fa/metadata/validation.json). The WikiText result comes from the matching local run's `evaluation/result` event at step 32,000; it isn't included in that Hub JSON. I've included both raw events, source hashes, and corpus manifests in the [article's evaluation evidence](/assets/data/zehn-135m/evaluation-evidence.json).

The external corpus is the **validation** split of [Salesforce/wikitext, `wikitext-103-raw-v1`](https://huggingface.co/datasets/Salesforce/wikitext/tree/b08601e04326c79dfdd32d625aee71d232d685c3), revision `b08601e04326c79dfdd32d625aee71d232d685c3`. The preparation script reconstructs articles and normalizes whitespace. This is token-level perplexity under Zehn's tokenizer and preprocessing, so it isn't directly comparable to published word-level WikiText scores.

Both sources were checked repeatedly during training. Neither is a blind final test. I haven't included a WikiText test-split result, final-checkpoint task benchmarks, a contamination analysis, or a human evaluation. Dataset origin alone doesn't prove absence of overlap.

### Actual completions from the released weights

I ran the local FP16 export after checking its weights, tokenizer, configuration, and Python implementation against the public release's SHA-256 manifest. Inference used **CPU FP32**, Python 3.11.0, PyTorch `2.15.0+cpu`, Transformers `4.57.6`, eight CPU threads, and seed 42.

Each prompt received its **first greedy completion**, with `do_sample=False`, one beam, a repetition penalty of `1.1`, `max_new_tokens=32`, and `use_cache=False`. The tokenizer adds BOS and doesn't append EOS to the prompt. These are the complete generated continuations, without retries or editing; they end mid-sentence because each reached the 32-token cap.

**Prompt: `The future of small language models is`**

```text
a long one. We are seeing a lot of new applications in the field of language learning, and we are seeing a lot of new applications in the field of
```

This stays near the topic but repeats a phrase even with the repetition penalty.

**Prompt: `Once upon a time, in a small village,`**

```text
lived two best friends named Sam and Alex. They loved exploring the world around them and learning new things every day! One sunny afternoon, they decided to go on
```

This produces a locally coherent story opening. One short continuation doesn't establish sustained narrative quality.

**Prompt: `The capital of France is`**

```text
the capital of the Netherlands. It is a small country in the northwest of the country, and is located on the border between the United Kingdom and the Netherlands
```

This is factually wrong. The example shows why fluent completion and factual accuracy need separate evaluation.

The [generation record](/assets/data/zehn-135m/generation-examples.json) includes prompts, exact output token IDs, completions, settings, environment versions, and file hashes. The [reproduction script](/assets/data/zehn-135m/generate_examples.py) verifies the pinned files and runs all three prompts. Other precisions, runtimes, or decoding settings may produce different text.

### Limits of this checkpoint

The evidence supports a small base model learning next-token patterns, with visible repetition and factual failures. It doesn't establish reasoning ability, coding accuracy, instruction following, or reliable factual answers. The validation results also don't provide a matched comparison against another 135M model.

The configuration permits **330,000 tokens**, but training used **1,024-token sequences**. I haven't validated long-context quality, memory use, or numerical behavior at the configured limit. The examples stay within the training length.

## Running the model: Python and C# examples

### Python with the pinned Transformers release

Install dependencies in a Python environment:

```bash
python -m pip install "torch>=2.2" "transformers==4.57.6" safetensors sentencepiece
```

The release supplies executable custom model and tokenizer code. Review it before loading with `trust_remote_code=True`; Hugging Face documents the mechanism in its [custom-model guide](https://huggingface.co/docs/transformers/custom_models).

Save this as `run_zehn.py`. It uses the same CPU precision and decoding choices as the recorded examples:

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "GrowBitLabs/zehn-135m"
revision = "f77ddf738caac00c06d10ac5534bb8d4bdfc44fa"

torch.set_num_threads(8)
torch.manual_seed(42)
tokenizer = AutoTokenizer.from_pretrained(
    model_id,
    revision=revision,
    trust_remote_code=True,
    add_eos_token=False,
)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    revision=revision,
    trust_remote_code=True,
    torch_dtype=torch.float32,
).to("cpu").eval()

prompt = "The future of small language models is"
inputs = tokenizer(prompt, return_tensors="pt")
max_new_tokens = 32
if inputs["input_ids"].shape[1] + max_new_tokens > 1_024:
    raise ValueError("Shorten the prompt or reduce max_new_tokens.")

with torch.inference_mode():
    output = model.generate(
        **inputs,
        max_new_tokens=max_new_tokens,
        do_sample=False,
        num_beams=1,
        repetition_penalty=1.1,
        use_cache=False,
        pad_token_id=tokenizer.eos_token_id,
        eos_token_id=tokenizer.eos_token_id,
    )

print(tokenizer.decode(output[0], skip_special_tokens=True))
```

Run `python run_zehn.py`. To use a downloaded copy, replace `model_id` with the export directory. For CUDA, move both the model and inputs to CUDA and select an appropriate dtype; those settings won't exactly reproduce the CPU run recorded above.

For stochastic completions, use `do_sample=True`, `temperature=0.8`, `top_k=40`, and `top_p=0.95`. Sampling changes token selection and output variation; it doesn't establish correctness.

### Native C# inference

The C# example requires the **Zehn source checkout**, its tokenizer, and the original native checkpoint directory containing `model.bin`, configuration, and integrity metadata. The public Transformers export has a different layout. Its `native/model.safetensors` file isn't a drop-in replacement for `model.bin` in this loader.

From the Zehn checkout, create a console application referencing the core project:

```bash
dotnet new console -n ZehnDemo -o examples/ZehnDemo
dotnet add examples/ZehnDemo/ZehnDemo.csproj reference src/Zehn/Zehn.csproj
```

Replace `Program.cs` with:

```csharp
using Zehn;

var checkpoint = Path.GetFullPath(
    "artifacts/135m-checkpoints/step-032000");
var loaded = Checkpoints.LoadForInference(checkpoint);
var config = loaded with
{
    Device = "cpu",
    Model = loaded.Model with
    {
        UseBf16Projections = false,
        UseFp16Projections = false
    },
    GpuTemperatureControl = loaded.GpuTemperatureControl with
    {
        Enabled = false
    }
};

var device = RuntimeSetup.Initialize(config);
var tokenizer = new SentencePieceBpe(
    config.Tokenizer, config.Model.VocabularySize);
using var model = new ZehnLanguageModel(config.Model);
model.to(device);
model.load(Path.Combine(checkpoint, "model.bin"));
model.eval();

var generation = config.Generation with { MaxNewTokens = 32 };
var completion = Generator.Generate(
    model, tokenizer,
    "The future of small language models is",
    generation, device, config.Seed);
Console.WriteLine(completion);
```

Run from the Zehn repository root so the relative checkpoint and tokenizer paths resolve:

```bash
dotnet run -c Release --project examples/ZehnDemo
```

I disable BF16/FP16 projections and CUDA temperature control for CPU inference. The checkout pins its SDK in `global.json` and selects CPU or CUDA LibTorch packages through its build configuration. This example keeps the checkpoint's sampling settings, so it isn't an output-parity test against the greedy Python examples.

## Release formats and reproducibility

| Released path | Contents and runtime requirements |
|---|---|
| `model.safetensors` | FP16 Transformers weights; use the supplied custom Python classes |
| `native/model.safetensors` | FP16 weights with native tensor names for compatible custom loaders |
| `gguf/zehn-135m-step-032000-f16.gguf` | FP16 GGUF container with the custom `zehn` architecture |
| `tokenizer.model` and tokenizer code | SentencePiece vocabulary and Python tokenizer integration |
| `metadata/` | Training configuration, checkpoint provenance, and mixture validation metrics |
| `MANIFEST.sha256` | Checksums for the released files |

The GGUF export requires a runtime implementing Zehn's DeltaNet and MoE operators. The release documents that stock `llama.cpp` cannot run it. A container format alone doesn't make an architecture executable in an existing runtime.

For the examples, I pinned the Hub revision and verified the local export against its [release checksum manifest](https://huggingface.co/GrowBitLabs/zehn-135m/blob/f77ddf738caac00c06d10ac5534bb8d4bdfc44fa/MANIFEST.sha256). The Transformers weights have SHA-256:

```text
5a2015967ab37d2887cc4ab0248bc251abeb73c775a55714458d460d122db205
```

The [generation record](/assets/data/zehn-135m/generation-examples.json) and [evaluation evidence](/assets/data/zehn-135m/evaluation-evidence.json) separate the new Python inference run from the original native validation measurements. I haven't rerun that validation through the FP16 export or established numerical equivalence between both implementations.

The release supports reproducible inference more fully than complete retraining. The recorded training `codeCommit` is `unknown`, although the native build identity, tokenizer hash, and training-data hash are recorded. The Hub bundle also doesn't include the C# source checkout, original native `model.bin`, optimizer state, or prepared training shards. Those gaps prevent reproducing the full C# training run from the model download alone.

The released weights and accompanying code use Apache 2.0. Training datasets retain their own terms; the preparation manifest records them separately.

## Lessons learned and next steps

Building Zehn made the boundary between model definition and runtime behavior concrete. I could implement the training loop in C#, but tensor ownership, mixed precision, checkpoint integrity, and incremental decoding still required careful engineering. Exporting the weights also required implementing the same layers in Python.

The evaluation changed how I interpret progress. A lower loss on a small slice of the training mixture can coexist with worse validation on another source and obviously incorrect generated facts. The step-32,000 checkpoint is useful for inspecting that behavior, but its training step doesn't make it the best checkpoint for every task.

My next steps are to evaluate full validation splits and a reserved test set, measure contamination and task performance, compare checkpoints using more than the mixture loss, and establish C#/Python parity before adding Python state caching. A source revision and complete training artifacts would also strengthen retraining reproducibility. Instruction tuning would be a separate experiment with its own evaluation.

If you try [Zehn-135M](https://huggingface.co/GrowBitLabs/zehn-135m), start with short completion prompts and record the revision, precision, and decoding settings. Keep the failed completions alongside the successful ones: they reveal what this checkpoint can currently support.
