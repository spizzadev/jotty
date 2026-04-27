# Runtime Patches

Some upstream issues (e.g. Next.js standalone builds ignoring `serverActions.bodySizeLimit`) need a small post-install rewrite of files inside `node_modules` to be resolved. jotty·page ships a tiny patch system that runs at container start, before the server boots.

## Where patches live

- `patches/` — patches shipped with the image. Each file is a small JS module exporting `{ name, apply(ctx) }`. They are applied in alphabetical order.
- `user_patches/` — optional, mounted from your host. Any `.js` files dropped here are applied **after** the built-in patches, so you can layer custom tweaks on top of (or in addition to) the defaults without rebuilding the image.

## Adding your own patches

1. Create a folder `user_patches/` next to your `docker-compose.yml`.
2. Drop a `.js` file in it, e.g. `user_patches/my-tweak.js`:

   ```js
   const fs = require("fs");
   const path = require("path");

   module.exports = {
     name: "my-tweak",
     apply: (ctx) => {
       /* ctx.projectRoot points at /app inside the container
          do whatever you need; return a short status string */
       return "applied";
     },
   };
   ```

3. Mount it in `docker-compose.yml`:

   ```yaml
   volumes:
     - ./user_patches:/app/user_patches:ro
   ```

4. Restart the container. Patch output is logged to stdout on every start.

Patches should be **idempotent** — they run on every restart. Use anchored regex/lookahead checks or compare against the target value before writing, so re-running the same patch is a no-op.

## Built-in patches

<details>
<summary><code>body-size-limit_20260427.js</code> — raise the 1MB Server Actions body cap</summary>

Next.js 16 ignores `serverActions.bodySizeLimit` from `next.config` in standalone builds, leaving the hard-coded 1MB cap baked into `app-page*.runtime.prod.js`. This patch rewrites that cap so server actions (file uploads, drawio attachments, avatar uploads, etc.) accept larger payloads.

- **Configurable via:** `JOTTY_BODY_SIZE_LIMIT` env var
- **Default:** `100mb`
- **Accepts:** `b`, `kb`, `mb`, `gb` (e.g. `50mb`, `2gb`)
- **Tracking issue:** [#422](https://github.com/fccview/jotty/issues/422)

```yaml
environment:
  - JOTTY_BODY_SIZE_LIMIT=250mb
```

</details>
