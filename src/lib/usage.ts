/**
 * Usage accounting — client-side view.
 *
 * WHAT THIS IS
 * A live readout of what the current browsing session has consumed, computed
 * from the usage the Gateway reports at the end of every AI response.
 *
 * WHAT THIS IS NOT
 * A billing record. Everything here lives in browser memory: it resets on
 * reload, counts only what this tab has seen, and could be altered by anyone
 * with dev tools open. Real billing must come from the server (`UsageService`
 * on the backend already captures the same events) — never from these numbers.
 * Treat this as an instrument panel, not a meter that money depends on.
 *
 * THE WIRE FORMAT  (verified against the live Gateway, 07 Sep 2026)
 * The terminal `done` event carries:
 *
 *   { total_tokens, input_tokens, output_tokens, cached_tokens,
 *     cache_read_input_tokens, cache_creation_input_tokens, reasoning_tokens,
 *     audio_duration_seconds, audio_duration_minutes, cost }
 *
 * `cost` is the Gateway's own computed figure in USD, so we never recompute
 * prices from token counts — no rate table to maintain, and no drift when a
 * model's price changes.
 */

/** Token counts exactly as the Gateway names them. Not renamed, not reshaped. */
export interface GatewayUsage {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    /**
     * The portion of `input_tokens` that hit the prompt cache.
     * IMPORTANT: this is a SUBSET of input_tokens, not an addition to it.
     * Verified: 2,207 input of which 2,048 cached priced as
     * 159 × $0.05/M + 2,048 × $0.005/M + 184 output × $0.40/M = the exact
     * cost the Gateway reported. Adding input + cached double-counts.
     */
    cached_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    /** Reasoning models (gpt-5-nano and similar) spend these internally. */
    reasoning_tokens?: number;
    audio_duration_seconds?: number;
    audio_duration_minutes?: number;
    /** Gateway-computed cost in USD. The authority. */
    cost?: number;
}

/**
 * Business configuration.
 *
 * MARKUP is the 3× rule. Never hard-code `3` at a call site — changing the
 * business model should be one value in one place.
 *
 * USD_TO_INR is a placeholder and MUST be set deliberately. The Gateway prices
 * in USD; showing rupees means picking a rate. A stale rate silently erodes
 * margin, so for anything customers actually pay, the server should record the
 * rate used against each event rather than relying on a build-time constant.
 */
export const USAGE_CONFIG = {
    markup: Number(process.env.NEXT_PUBLIC_USAGE_MARKUP ?? 3),
    usdToInr: Number(process.env.NEXT_PUBLIC_USD_TO_INR ?? 90),
} as const;

export interface PricedUsage {
    usage: GatewayUsage;
    /** What the Gateway says the request cost us, USD. */
    costUsd: number;
    /** Our cost in paise (integer — never do money in floats). */
    actualPaise: number;
    /** What the customer consumes: actual × markup, in paise. */
    customerPaise: number;
    /** Non-cached input. Useful because it is what is actually charged at full rate. */
    freshInputTokens: number;
}

export function priceUsage(usage: GatewayUsage): PricedUsage {
    const costUsd = typeof usage.cost === 'number' ? usage.cost : 0;
    const actualPaise = Math.round(costUsd * USAGE_CONFIG.usdToInr * 100);
    const input = usage.input_tokens ?? 0;
    const cached = usage.cached_tokens ?? 0;

    return {
        usage,
        costUsd,
        actualPaise,
        customerPaise: Math.round(actualPaise * USAGE_CONFIG.markup),
        freshInputTokens: Math.max(0, input - cached),
    };
}

export interface UsageTotals {
    requests: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    reasoningTokens: number;
    costUsd: number;
    actualPaise: number;
    customerPaise: number;
}

export const EMPTY_TOTALS: UsageTotals = {
    requests: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0,
    cachedTokens: 0, reasoningTokens: 0, costUsd: 0, actualPaise: 0, customerPaise: 0,
};

export function addUsage(totals: UsageTotals, priced: PricedUsage): UsageTotals {
    const u = priced.usage;
    return {
        requests: totals.requests + 1,
        totalTokens: totals.totalTokens + (u.total_tokens ?? 0),
        inputTokens: totals.inputTokens + (u.input_tokens ?? 0),
        outputTokens: totals.outputTokens + (u.output_tokens ?? 0),
        cachedTokens: totals.cachedTokens + (u.cached_tokens ?? 0),
        reasoningTokens: totals.reasoningTokens + (u.reasoning_tokens ?? 0),
        costUsd: totals.costUsd + priced.costUsd,
        actualPaise: totals.actualPaise + priced.actualPaise,
        customerPaise: totals.customerPaise + priced.customerPaise,
    };
}

/**
 * Rupees from paise. Sub-paise amounts are common — a short question can cost
 * a fraction of one paisa — so show enough precision to avoid a wall of
 * "₹0.00" while keeping larger figures readable.
 */
export function formatINR(paise: number): string {
    const rupees = paise / 100;
    if (rupees === 0) return '₹0';
    if (rupees < 0.01) return '< ₹0.01';
    if (rupees < 1) return `₹${rupees.toFixed(2)}`;
    if (rupees < 1000) return `₹${rupees.toFixed(2)}`;
    return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatTokens(n: number): string {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
    return `${(n / 1_000_000).toFixed(2)}M`;
}

/**
 * Narrows the unknown value handed to `onDone`. The Gateway's shape is
 * verified, but the agent is configured outside this codebase and could change
 * — so anything unrecognised is discarded rather than counted as zero, which
 * would quietly under-report.
 */
export function parseUsage(raw: unknown): GatewayUsage | null {
    if (!raw || typeof raw !== 'object') return null;
    const u = raw as Record<string, unknown>;
    const hasTokens = typeof u.total_tokens === 'number' || typeof u.input_tokens === 'number';
    return hasTokens ? (u as GatewayUsage) : null;
}
