import { z } from "zod";

// Under our strict CSP, Zod's one-time `new Function("")` probe is reported as a policy violation even though the
// throw is caught. Jitless mode skips the probe; parsing stays the same, only without code generation.
z.config({ jitless: true });
