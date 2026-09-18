# PONYTAIL

> Der beste Code ist der, den du nie geschrieben hast.
>
> Weniger ist mehr.

PONYTAIL is one portable Agent Skill for the full software lifecycle. It behaves like a pragmatic, pleasantly lazy senior developer: challenge unnecessary work, complete missing essentials, reuse what exists, and otherwise make the smallest clean change.

The PONYTAIL core remains authoritative. Helper modules are loaded only when they make the current task safer or better.

## Capabilities

- **Truth Mode:** direct facts, assumptions, limits, and realistic alternatives
- **Define:** incomplete ideas, ExtendThings, ALT3, intent, specifications
- **Plan:** search-first, progressive context, official sources, reuse/adapt/build, task slices
- **Build:** incremental implementation, TDD, APIs, UI, security
- **Verify:** acceptance and regression gates, debugging, browser/runtime evidence, performance
- **Review:** quality, simplification, Red Team, Future You
- **Ship:** Git, CI/CD, documentation, migration, rollback, release
- **Second Brain:** optional permission-gated local Markdown memory

PONYTAIL stops when the approved goal is met and verified. It loads one current-phase module by default and does not run every module for every task.

## Memory and Privacy

At first use per chat, PONYTAIL asks for no memory, read-only memory, or read/write memory. Without an answer it continues with no access. The default local memory store is plaintext Markdown in the host's user-home directory (for example `$HOME/.ponytail-memory`), outside this repository. PONYTAIL does not encrypt it; confidentiality depends on the host's filesystem, sync, and backup controls. It never stores secrets, full chats, transient task state, sensitive personal data, or instructions derived from untrusted content.

## Install

PONYTAIL follows the [Agent Skills specification](https://agentskills.io/specification).

### Codex

```sh
git clone https://github.com/easycrashx-nex/ponytail-skill.git "$HOME/.agents/skills/ponytail"
```

See the [Codex skills documentation](https://developers.openai.com/codex/skills).

### Claude Code

```sh
git clone https://github.com/easycrashx-nex/ponytail-skill.git "$HOME/.claude/skills/ponytail"
```

See the [Claude Code skills documentation](https://code.claude.com/docs/en/skills).

### Other LLMs

Install this repository in the host's Agent Skills directory. Without Agent Skills support, provide `SKILL.md` and only the relevant referenced module as system or custom instructions.

Automatic routing, filesystem memory, and tool use depend on the host. The core instructions remain model-independent.

## Attribution

Lifecycle-module concepts are inspired by [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) and [affaan-m/ECC](https://github.com/affaan-m/ECC). Both upstream projects are MIT-licensed; no upstream runtime is bundled. See [Third-Party Notices](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE)
