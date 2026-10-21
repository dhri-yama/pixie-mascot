// Script-tag build: <script src=".../pixie.global.js"></script> then <pixie-mascot text="bubba">.
import * as core from "./index";
import { definePixieElement, mountMascot } from "./dom";

definePixieElement();
(globalThis as unknown as { Pixie: unknown }).Pixie = { ...core, mountMascot, definePixieElement };
