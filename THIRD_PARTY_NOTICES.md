# Third-party components and license scope

Reviewed October 29, 2026 against the installed package manifests, license files and frozen lockfile.

The root MIT [LICENSE](LICENSE) covers AgentBridge's newly written source, tests, development scripts, original documentation and synthetic examples. It does not change the licenses of dependencies, linked reference projects, tools or trademarks. This source publication includes no vendored dependency code, package binaries, compiler installation or downloaded agent/runtime executables.

## Development dependencies (not distributed in the source publication)

| Package | Locked version | Upstream license | Notice inspected locally |
| --- | --- | --- | --- |
| [TypeScript](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 | `node_modules/typescript/LICENSE.txt` and `ThirdPartyNoticeText.txt` |
| [Node definitions / DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node) | 22.19.0 | MIT; Microsoft Corporation notice in installed package | `node_modules/@types/node/LICENSE` |
| [undici-types / Undici](https://github.com/nodejs/undici) | 6.21.0 | MIT; Matteo Collina and Undici contributors | `node_modules/undici-types/LICENSE` |

TypeScript is a development compiler. Node/Undici definitions are development types. None is a runtime npm dependency. Their upstream copyright/license notices remain in the separately installed packages. The compiler's own third-party notice file is not an AgentBridge notice and is not relicensed under MIT. No portion of those packages is vendored by this publication.

## Prerequisites and CI tools (not redistributed)

Node.js, Git, pnpm and an optional installed Codex CLI are separately obtained tools with their own upstream licenses. The optional local Codex validator does not bundle Codex. The Node 22 archive used during validation remains under excluded `.cache/`.

CI downloads the MIT-licensed [`actions/checkout`](https://github.com/actions/checkout) and [`actions/setup-node`](https://github.com/actions/setup-node), pinned by full commit SHA in the workflow. They and their transitive dependencies are not incorporated into AgentBridge source; their own distributions carry their notices. CI installs the three frozen development packages with lifecycle scripts disabled. There is no publish/deploy workflow.

The MIT license files at the exact pinned revisions were checked: [checkout license](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/LICENSE) and [setup-node license](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/LICENSE), both bearing GitHub, Inc. and contributors' notices. Those files remain upstream rather than being presented as AgentBridge-owned code.

No copied competitor implementation, logo or other third-party asset was found in the reviewed publication set. Reference links and compatibility names do not imply affiliation. If a future distribution bundles dependencies, runtime/compiler helpers, executables or other third-party material, review that exact distribution and carry all required upstream notices before release.

See [provenance](docs/PROVENANCE.md) for original-source history and [publication audit](docs/PUBLICATION_AUDIT.md) for the reviewed file boundary. The package remains `private: true`; this preparation concerns a source repository, not an npm release.
