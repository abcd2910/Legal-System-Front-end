'use client';

import { useState } from 'react';
import {
    type PricedUsage,
    type UsageTotals,
    formatINR,
    formatTokens,
    USAGE_CONFIG,
} from '@/lib/usage';

/**
 * UsageMeter — what this session has consumed.
 *
 * Two deliberate choices:
 *
 * The rupee figure is primary and token counts are secondary. Tokens mean
 * nothing to an advocate and invite arguments about whether a long question
 * "should" have cost that much; a rupee value is immediately legible. The
 * counts are still there for anyone who wants them, one click away.
 *
 * No violet. In this design system violet marks AI-generated or inferred
 * content — these are recorded facts reported by the Gateway, so they get
 * neutral treatment. Using the AI colour here would erode what it means.
 */
export function UsageMeter({
    totals,
    last,
    className = '',
}: {
    totals: UsageTotals;
    last: PricedUsage | null;
    className?: string;
}) {
    const [open, setOpen] = useState(false);

    if (totals.requests === 0) {
        return (
            <div className={`text-xs text-muted-foreground ${className}`}>
                No AI usage yet this session
            </div>
        );
    }

    return (
        <div className={`rounded-lg border border-border bg-card ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
                aria-expanded={open}
            >
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Session usage
                </span>

                <span className="tabular-nums text-sm font-semibold text-foreground">
                    {formatINR(totals.customerPaise)}
                </span>

                <span className="tabular-nums text-xs text-muted-foreground">
                    {formatTokens(totals.totalTokens)} tokens · {totals.requests}{' '}
                    {totals.requests === 1 ? 'request' : 'requests'}
                </span>

                <span className="ml-auto text-muted-foreground" aria-hidden="true">
                    <svg
                        width="14" height="14" viewBox="0 0 16 16" fill="none"
                        stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: open ? 'rotate(180deg)' : undefined }}
                    >
                        <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
                    </svg>
                </span>
            </button>

            {open && (
                <div className="border-t border-border px-3 py-2.5 text-xs">
                    {last && (
                        <>
                            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                Last response
                            </div>
                            <Row label="Input (new)" value={formatTokens(last.freshInputTokens)} />
                            {(last.usage.cached_tokens ?? 0) > 0 && (
                                <Row
                                    label="Input (cached)"
                                    value={formatTokens(last.usage.cached_tokens ?? 0)}
                                    hint="Charged at roughly a tenth of the normal input rate"
                                />
                            )}
                            <Row label="Output" value={formatTokens(last.usage.output_tokens ?? 0)} />
                            {(last.usage.reasoning_tokens ?? 0) > 0 && (
                                <Row
                                    label="Reasoning"
                                    value={formatTokens(last.usage.reasoning_tokens ?? 0)}
                                    hint="Internal tokens the model spent working out its answer"
                                />
                            )}
                            <Row label="Cost" value={formatINR(last.customerPaise)} strong />

                            <div className="my-2.5 border-t border-border" />
                        </>
                    )}

                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        This session
                    </div>
                    <Row label="Requests" value={String(totals.requests)} />
                    <Row label="Total tokens" value={formatTokens(totals.totalTokens)} />
                    <Row label="Of which cached" value={formatTokens(totals.cachedTokens)} />
                    <Row label="Total" value={formatINR(totals.customerPaise)} strong />

                    <p className="mt-2.5 leading-relaxed text-muted-foreground">
                        Counted in this browser tab only — it resets when you reload, and it
                        isn&apos;t the billing record. Charged at {USAGE_CONFIG.markup}× the
                        underlying cost.
                    </p>
                </div>
            )}
        </div>
    );
}

function Row({
    label,
    value,
    strong = false,
    hint,
}: {
    label: string;
    value: string;
    strong?: boolean;
    hint?: string;
}) {
    return (
        <div className="flex items-baseline justify-between py-0.5" title={hint}>
            <span className="text-muted-foreground">{label}</span>
            <span
                className={`tabular-nums ${strong ? 'font-semibold text-foreground' : 'text-foreground/80'}`}
            >
                {value}
            </span>
        </div>
    );
}
