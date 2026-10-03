// Reviewed against Coach Loop main at 142bb94; deletions are limited to this list.
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const candidates = [
  {
    "path": "app/effort-picker.tsx",
    "sha": "fc51e7f9c7216727ff6a92706bf6ab7dd49c16c6"
  },
  {
    "path": "app/exercise-substitution.tsx",
    "sha": "ccbf359d5187f8c9b725b7ea2811b448e1095f38"
  },
  {
    "path": "app/field-conflicts.ts",
    "sha": "78882f669df42811876de84aa9d463febd295d16"
  },
  {
    "path": "app/hyrox-ui.tsx",
    "sha": "99612b3542ec6a62ee9ad003c4593c7d0c772bf5"
  },
  {
    "path": "app/muscle-mapping-settings.tsx",
    "sha": "19f2196f58d9b2192c1f4ffd01b4c13fa70f0e05"
  },
  {
    "path": "app/persistence/sync-payload.ts",
    "sha": "49e128109960ce319be8e10914952d80f2ba73f3"
  },
  {
    "path": "app/persistence/sync-queue.ts",
    "sha": "b8e7e409d445798e518ed6c4a10a0ba32f75da5a"
  },
  {
    "path": "app/sync-queue.ts",
    "sha": "f14f67041e6f56d96b7b4aa0223639060fa04182"
  },
  {
    "path": "app/training-migrations.ts",
    "sha": "1f31db141f67ab9d1cc08b9224dd966a94047c49"
  },
  {
    "path": "app/training-review.tsx",
    "sha": "509a7be113ac26351508074c32b8d9bc20583cd6"
  },
  {
    "path": "app/training-storage.ts",
    "sha": "7163e64622bfd2732403d2fcb7203fa5a076d588"
  },
  {
    "path": "app/training-validation.ts",
    "sha": "be0af2346800cba70e7132730570f0d4fd49ec6b"
  },
  {
    "path": "app/use-local-editor-lease.ts",
    "sha": "0238b339199c04ad2cd112a054aa6accf90aaccb"
  },
  {
    "path": "app/views/effort-picker.tsx",
    "sha": "6f9de1d42b82fee792f30fe13a4302a9f7a7ccda"
  },
  {
    "path": "components/ui/accordion.tsx",
    "sha": "91e3a250ce6ee0797b0258454d774800650adcc8"
  },
  {
    "path": "components/ui/alert.tsx",
    "sha": "f99164ed4b320790482f514342dab5e72f284aca"
  },
  {
    "path": "components/ui/aspect-ratio.tsx",
    "sha": "57e38fa96f9c0cb767d7b8de0d6dbc171d1b921a"
  },
  {
    "path": "components/ui/attachment.tsx",
    "sha": "5bdd1ce7db5800eb55198cd0291a1e47dc67fb0d"
  },
  {
    "path": "components/ui/avatar.tsx",
    "sha": "ea658505703a577fe93341e5e1a0b478c27245f7"
  },
  {
    "path": "components/ui/breadcrumb.tsx",
    "sha": "004bb63a4c92229e612b6126d79fb7b078aa7565"
  },
  {
    "path": "components/ui/bubble.tsx",
    "sha": "792146e61d80ef595d032d5d09a3d572d50f1374"
  },
  {
    "path": "components/ui/button-group.tsx",
    "sha": "cd550d7afca6562548afe3f595b352406f7f3951"
  },
  {
    "path": "components/ui/calendar.tsx",
    "sha": "5d31419b130a18c52320f5a21546a9236123b6bf"
  },
  {
    "path": "components/ui/carousel.tsx",
    "sha": "0e05a77ea155fde6af5d9a4848b1d3953df6ea5a"
  },
  {
    "path": "components/ui/chart.tsx",
    "sha": "9813c584e125847d88e9e7e7f9edff7e9ba45a97"
  },
  {
    "path": "components/ui/collapsible.tsx",
    "sha": "2f7a4e7fc64a8874373c1584646a63f28cd63c47"
  },
  {
    "path": "components/ui/combobox.tsx",
    "sha": "2415bd801031a16bbcee8343058825feecfaea69"
  },
  {
    "path": "components/ui/command.tsx",
    "sha": "8fe3ccb406be52d28961b0c0220e87ecd19596ca"
  },
  {
    "path": "components/ui/context-menu.tsx",
    "sha": "5aaca76552cf0468b1def03c9e2c42f1f0b60734"
  },
  {
    "path": "components/ui/direction.tsx",
    "sha": "22e165774bd595fbf41d0c45efef1cf996897983"
  },
  {
    "path": "components/ui/drawer.tsx",
    "sha": "ad08671442203fe345093f364696bdf43528e0b7"
  },
  {
    "path": "components/ui/empty.tsx",
    "sha": "ce4b0095f6d19d2eae2e465060e9060b0c210856"
  },
  {
    "path": "components/ui/field.tsx",
    "sha": "ec849dae4d3dd06a973ba22e4b2248a25cf18148"
  },
  {
    "path": "components/ui/form.tsx",
    "sha": "f371fea1bc35380d28678c6cf53df8f65deb2776"
  },
  {
    "path": "components/ui/hover-card.tsx",
    "sha": "91e869c0d3091cbeddf5cb0266e82ddf56f829a6"
  },
  {
    "path": "components/ui/input-group.tsx",
    "sha": "a7652d936fffd9c5bca4b88e6b9715bf559e667d"
  },
  {
    "path": "components/ui/input-otp.tsx",
    "sha": "6a556afacd71996bf0e385ff2b04869fb2ee4523"
  },
  {
    "path": "components/ui/item.tsx",
    "sha": "d5dbb1a9c2e70456e45a39887a4b7cc56d484a45"
  },
  {
    "path": "components/ui/kbd.tsx",
    "sha": "2459224fbc531f6306b73aaeb22e9022d9985332"
  },
  {
    "path": "components/ui/label.tsx",
    "sha": "1ac80f701ebfe9dc02d632c08cafade732e46625"
  },
  {
    "path": "components/ui/marker.tsx",
    "sha": "cfa76c6c014ab342befcbf7571eb932917406522"
  },
  {
    "path": "components/ui/menubar.tsx",
    "sha": "4af16a428377f81cbb3f66adfe518308e0b690d8"
  },
  {
    "path": "components/ui/message-scroller.tsx",
    "sha": "0b05011259c026a357380c3834bce0ead8565d22"
  },
  {
    "path": "components/ui/message.tsx",
    "sha": "53437e8db2b0fad1da06a7499e54ddaf116295c2"
  },
  {
    "path": "components/ui/navigation-menu.tsx",
    "sha": "0a673f513c97fbeaae0872403b7582ab2ba7e3c3"
  },
  {
    "path": "components/ui/pagination.tsx",
    "sha": "1dcfb0cc050c5f2bdd930522d627313d03d3690c"
  },
  {
    "path": "components/ui/popover.tsx",
    "sha": "30058c4ec284ca9cad1ed1162d084ce3cd94e2b0"
  },
  {
    "path": "components/ui/progress.tsx",
    "sha": "b3ae25089ad549b7f13125e482f99b43dd895bd2"
  },
  {
    "path": "components/ui/radio-group.tsx",
    "sha": "fe514536ed771f7adef0a6b9e4d1aeadc2c95481"
  },
  {
    "path": "components/ui/resizable.tsx",
    "sha": "a76832a10b4c5c2a137e25c16478567ba86daf0d"
  },
  {
    "path": "components/ui/scroll-area.tsx",
    "sha": "73c4eb1cdcd4a699b150a9ddc3e87bfb90b63d09"
  },
  {
    "path": "components/ui/select.tsx",
    "sha": "c0dc7120b4f78008ae5efc6d1c8b7ec8205c35d5"
  },
  {
    "path": "components/ui/separator.tsx",
    "sha": "cd873e3631b571060f166897b7b62e033e87c18f"
  },
  {
    "path": "components/ui/sheet.tsx",
    "sha": "cb53bb28b6850745c9519e8e7462e05f85a50c93"
  },
  {
    "path": "components/ui/sidebar.tsx",
    "sha": "f5f6c5aefc88ffa2e999e284b299472215c05161"
  },
  {
    "path": "components/ui/skeleton.tsx",
    "sha": "3ec6be770b846170b8e7f8916e5f165e2d1730df"
  },
  {
    "path": "components/ui/slider.tsx",
    "sha": "46ebc4b4df1e9baf1f3997a4b6c08ef80c84a9c9"
  },
  {
    "path": "components/ui/spinner.tsx",
    "sha": "a70e713c5b4ecb2af186efe3fadea51805f26ba5"
  },
  {
    "path": "components/ui/switch.tsx",
    "sha": "8baa844fdb17d668b3ce07cfbd6a7ef52e2eb5eb"
  },
  {
    "path": "components/ui/table.tsx",
    "sha": "7add5f1a22db954ac6cb3446f1bf8c8a9fc5c335"
  },
  {
    "path": "components/ui/toggle-group.tsx",
    "sha": "9894607b212ff7182bf2024f4262da03df0a8973"
  },
  {
    "path": "components/ui/toggle.tsx",
    "sha": "5250c98ff7f11f531af38c227230a76b7d25bf19"
  },
  {
    "path": "components/ui/tooltip.tsx",
    "sha": "ec65c1e4255f050d9555c6cdade90a5f8a6c0c29"
  },
  {
    "path": "hooks/use-mobile.ts",
    "sha": "2b0fe1dfef3b17850bbac040665f514a8ffd0f15"
  }
];
const args = process.argv.slice(2);
if (args.some(arg => arg !== "--apply")) throw new Error("Use node scripts/cleanup-repo.mjs [--apply]");
const root = realpathSync(process.cwd());
const gitRoot = realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], {encoding:"utf8"}).trim());
if (gitRoot !== root || JSON.parse(readFileSync("package.json", "utf8")).name !== "coach-loop-github") throw new Error("Run this only from the CoachLoop repository root.");
const tracked = new Set(execFileSync("git", ["ls-files", "-z"], {encoding:"utf8"}).split("\0"));
const ready = [], modified = [];
for (const item of candidates) {
 if (!tracked.has(item.path)) continue;
 let bytes; try { bytes = readFileSync(resolve(root,item.path)); } catch { modified.push(item.path); continue; }
 const hash = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
 if (hash !== item.sha) modified.push(item.path); else ready.push(item.path);
}
if (modified.length) throw new Error("Cleanup stopped: these files differ from the reviewed source. Preserve your changes and request a new review:\n" + modified.join("\n"));
console.log(`${ready.length} unchanged, tracked files eligible for removal:`);
console.log(ready.join("\n"));
if (!args.includes("--apply")) console.log("Preview only. To stage these exact deletions, run: node scripts/cleanup-repo.mjs --apply");
else if (ready.length) { execFileSync("git", ["rm", "--", ...ready], {stdio:"inherit"}); console.log("Deletions staged. Run all checks before committing."); }
else console.log("Nothing to remove.");
