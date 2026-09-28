'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
    billingApi, loadRazorpay, fmtCredits, fmtINR, FEATURE_LABEL,
    type BillingState, type LedgerEntry, type RazorpayCheckoutResponse,
} from '@/lib/billing';

/**
 * Usage & billing.
 *
 * Built in Chambers, under its three laws:
 *   1. Violet is machine — nothing here is AI-authored, so there is no violet.
 *   2. Accent is position and commitment — exactly one accent-filled control
 *      per region: the plan you buy, the pack you buy.
 *   3. Semantic colour is state, never category — plans and packs are
 *      differentiated by typography and position. Colour appears only when the
 *      balance is actually exhausted, or a subscription is actually active.
 *
 * Numbers are tabular throughout: a statement that does not align vertically
 * cannot be scanned.
 */

const PANEL = 'rounded-lg border border-border-subtle bg-surface';

export default function BillingPage() {
    const [state, setState] = useState<BillingState | null>(null);
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [orgId, setOrgId] = useState<string | null>(null);

    const load = useCallback(async (id?: string) => {
        try {
            setError(null);
            const s = await billingApi.get(id ?? orgId ?? undefined);
            setOrgId(s.organisation.id);
            setState(s);
            const { entries: e } = await billingApi.statement(s.organisation.id, 25);
            setEntries(e);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load billing.');
        }
    }, [orgId]);

    useEffect(() => { void load(); }, [load]);

    const subscribe = async (planCode: string) => {
        if (!state || !orgId) return;
        setBusy('subscribe'); setError(null);
        try {
            const s = await billingApi.subscribe(orgId, planCode);
            const Razorpay = await loadRazorpay();
            new Razorpay({
                key: s.razorpayKeyId,
                subscription_id: s.subscriptionId,
                name: 'LegalDesk',
                description: `${s.planName} — ${fmtCredits(s.includedCredits)} ${state.creditLabel.toLowerCase()} a month`,
                theme: { color: '#3EA88F' },
                handler: () => { void load(); },
                modal: { ondismiss: () => setBusy(null) },
            }).open();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start checkout.');
        } finally { setBusy(null); }
    };

    const topUp = async (packCode: string) => {
        if (!state || !orgId) return;
        setBusy(`pack:${packCode}`); setError(null);
        try {
            const o = await billingApi.topUp(orgId, packCode);
            const Razorpay = await loadRazorpay();
            new Razorpay({
                key: o.razorpayKeyId,
                order_id: o.orderId,
                amount: o.amountInr * 100,
                currency: 'INR',
                name: 'LegalDesk',
                description: `${o.packName} — ${fmtCredits(o.credits)} ${state.creditLabel.toLowerCase()}`,
                theme: { color: '#3EA88F' },
                handler: async (r: RazorpayCheckoutResponse) => {
                    try { await billingApi.confirmTopUp(orgId, r); await load(); }
                    catch (err) { setError(err instanceof Error ? err.message : 'Payment taken but not confirmed. Refresh in a moment.'); }
                },
                modal: { ondismiss: () => setBusy(null) },
            }).open();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start checkout.');
        } finally { setBusy(null); }
    };

    const cancel = async () => {
        if (!orgId) return;
        if (!confirm('Cancel at the end of this period? AI features keep working until then.')) return;
        setBusy('cancel');
        try { await billingApi.cancel(orgId); await load(); }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not cancel.'); }
        finally { setBusy(null); }
    };

    // ── Loading ──────────────────────────────────────────────────────
    if (!state) {
        return (
            <div className="min-h-screen bg-canvas">
                <Header />
                <main className="mx-auto w-full max-w-5xl px-6 py-10">
                    {error ? (
                        <div className="rounded-lg border border-border-subtle bg-danger-subtle px-4 py-3 text-danger">
                            {error}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="h-5 w-40 animate-pulse rounded-sm bg-hover" />
                            <div className="h-28 animate-pulse rounded-lg bg-surface" />
                        </div>
                    )}
                </main>
            </div>
        );
    }

    const b = state.balance;
    const isAdmin = state.organisation.role === 'ADMIN';
    const label = state.creditLabel;
    const total = b.allocatedCredits + b.toppedUpCredits;
    const pct = total > 0 ? Math.min(100, Math.round((b.consumedCredits / total) * 100)) : 0;
    const exhausted = state.enforcementEnabled && b.balanceCredits <= state.minBalanceCredits;
    const locked = busy !== null || !isAdmin;

    return (
        <div className="min-h-screen bg-canvas">
            <Header org={state.organisation.name} />

            <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">

                {/* Organisation switcher — only when there is a choice to make. */}
                {state.organisations.length > 1 && (
                    <div className="flex items-center gap-2">
                        <span className="label-caption">ORGANISATION</span>
                        <select
                            value={orgId ?? ''}
                            onChange={e => { setOrgId(e.target.value); void load(e.target.value); }}
                            className="rounded-sm border border-border-default bg-raised px-2 py-1 text-text-primary"
                        >
                            {state.organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-border-subtle bg-danger-subtle px-4 py-3 text-danger">
                        {error}
                    </div>
                )}

                {/* ── Balance ─────────────────────────────────────────── */}
                <section className={`${PANEL} p-6`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <div className="label-caption">{label.toUpperCase()} REMAINING</div>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className={`tabular text-4xl font-semibold ${exhausted ? 'text-danger' : 'text-text-primary'}`}>
                                    {fmtCredits(b.balanceCredits)}
                                </span>
                                <span className="text-text-tertiary">of {fmtCredits(total)} this period</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {b.hasSubscription ? (
                                <Chip tone="success">{b.subscriptionStatus ?? 'Active'}</Chip>
                            ) : (
                                <Chip>No active plan</Chip>
                            )}
                            {!state.enforcementEnabled && <Chip>Measuring only</Chip>}
                        </div>
                    </div>

                    <div className="mt-5 h-1.5 w-full overflow-hidden rounded-sm bg-sunken">
                        <div
                            className={`h-full ${exhausted ? 'bg-danger' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <div className="mt-2 flex justify-between text-text-tertiary">
                        <span className="tabular">{fmtCredits(b.consumedCredits)} used · {pct}%</span>
                        {b.periodStart && b.periodEnd && (
                            <span className="tabular">
                                {new Date(b.periodStart).toLocaleDateString('en-IN')} – {new Date(b.periodEnd).toLocaleDateString('en-IN')}
                            </span>
                        )}
                    </div>

                    {exhausted && (
                        <p className="mt-4 text-danger">
                            AI features are paused until you add more {label.toLowerCase()}. Everything else in LegalDesk keeps working.
                        </p>
                    )}
                    {!state.enforcementEnabled && (
                        <p className="mt-4 text-text-secondary">
                            Usage is being recorded but nothing is blocked. A negative figure here simply means
                            work was done before a plan started.
                        </p>
                    )}
                </section>

                {/* ── Plans ───────────────────────────────────────────── */}
                {!state.razorpayConfigured ? (
                    <section className={`${PANEL} px-6 py-5 text-text-secondary`}>
                        Payments are not switched on for this server yet.
                    </section>
                ) : !b.hasSubscription ? (
                    <section className="space-y-3">
                        <h2 className="text-base font-semibold text-text-primary">Choose a plan</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {state.plans.map(p => (
                                <div key={p.code} className={`${PANEL} flex flex-col gap-4 p-5`}>
                                    <div>
                                        <div className="font-semibold text-text-primary">{p.name}</div>
                                        {p.description && (
                                            <div className="mt-1 text-text-secondary">{p.description}</div>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="tabular text-2xl font-semibold text-text-primary">{fmtINR(p.priceInr)}</span>
                                        <span className="text-text-tertiary">a month</span>
                                    </div>
                                    <div className="tabular text-text-secondary">
                                        {fmtCredits(p.includedCredits)} {label.toLowerCase()} included
                                        {p.seatLimit ? ` · up to ${p.seatLimit} seats` : ''}
                                    </div>
                                    <button
                                        onClick={() => subscribe(p.code)}
                                        disabled={locked || !p.ready}
                                        className="mt-auto rounded-sm bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
                                    >
                                        {busy === 'subscribe' ? 'Opening…' : 'Choose'}
                                    </button>
                                    {!isAdmin && <p className="text-text-tertiary">Only an admin can subscribe.</p>}
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                {/* ── Top-ups ─────────────────────────────────────────── */}
                {state.razorpayConfigured && state.packs.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-base font-semibold text-text-primary">Add {label.toLowerCase()}</h2>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {state.packs.map(p => (
                                <div key={p.code} className={`${PANEL} flex flex-col gap-3 p-5`}>
                                    <div className="font-medium text-text-primary">{p.name}</div>
                                    <div className="tabular text-xl font-semibold text-text-primary">{fmtINR(p.priceInr)}</div>
                                    <div className="tabular text-text-secondary">{fmtCredits(p.credits)} {label.toLowerCase()}</div>
                                    <button
                                        onClick={() => topUp(p.code)}
                                        disabled={locked}
                                        className="mt-auto rounded-sm border border-border-default px-4 py-2 font-medium text-text-primary hover:bg-hover disabled:opacity-40"
                                    >
                                        {busy === `pack:${p.code}` ? 'Opening…' : 'Buy'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Where it went ───────────────────────────────────── */}
                <div className="grid gap-4 md:grid-cols-2">
                    <section className={`${PANEL} p-5`}>
                        <h2 className="mb-3 text-base font-semibold text-text-primary">Where it went</h2>
                        {state.breakdown.byFeature.length === 0 ? (
                            <p className="text-text-tertiary">Nothing recorded yet.</p>
                        ) : (
                            <ul className="divide-y divide-border-subtle">
                                {state.breakdown.byFeature.map(f => (
                                    <li key={f.feature} className="flex items-center justify-between py-2">
                                        <span className="text-text-primary">{FEATURE_LABEL[f.feature] ?? f.feature}</span>
                                        <span className="flex items-baseline gap-3">
                                            <span className="tabular text-text-tertiary">{f.operations} ops</span>
                                            <span className="tabular font-medium text-text-primary">{fmtCredits(f.credits)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className={`${PANEL} p-5`}>
                        <h2 className="mb-3 text-base font-semibold text-text-primary">By person</h2>
                        {state.breakdown.byUser.length === 0 ? (
                            <p className="text-text-tertiary">Nothing recorded yet.</p>
                        ) : (
                            <ul className="divide-y divide-border-subtle">
                                {state.breakdown.byUser.map(u => (
                                    <li key={u.userId} className="flex items-center justify-between py-2">
                                        <span>
                                            <span className="text-text-primary">{u.name}</span>
                                            <span className="ml-2 text-text-tertiary">{u.email}</span>
                                        </span>
                                        <span className="tabular font-medium text-text-primary">{fmtCredits(u.credits)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                {/* ── Statement ───────────────────────────────────────── */}
                <section className={`${PANEL} p-5`}>
                    <h2 className="mb-3 text-base font-semibold text-text-primary">Statement</h2>
                    {entries.length === 0 ? (
                        <p className="text-text-tertiary">No entries yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full tabular">
                                <thead>
                                    <tr className="border-b border-border-subtle text-left">
                                        <th className="label-caption py-2 font-medium">ENTRY</th>
                                        <th className="label-caption py-2 font-medium">WHEN</th>
                                        <th className="label-caption py-2 text-right font-medium">{label.toUpperCase()}</th>
                                        <th className="label-caption py-2 text-right font-medium">BALANCE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((e, i) => (
                                        <tr key={i} className="border-b border-border-subtle last:border-0">
                                            <td className="py-2.5">
                                                <div className="text-text-primary">
                                                    {e.feature ? (FEATURE_LABEL[e.feature] ?? e.feature) : (e.reason ?? e.type)}
                                                </div>
                                                {(e.tokens || e.model) && (
                                                    <div className="font-mono text-text-tertiary">
                                                        {e.tokens ? `${fmtCredits(e.tokens)} tokens` : ''}
                                                        {e.tokens && e.model ? ' · ' : ''}
                                                        {e.model ?? ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2.5 text-text-tertiary">
                                                {new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className={`py-2.5 text-right ${e.credits < 0 ? 'text-text-secondary' : 'text-success'}`}>
                                                {e.credits > 0 ? '+' : ''}{fmtCredits(e.credits)}
                                            </td>
                                            <td className="py-2.5 text-right text-text-primary">{fmtCredits(e.balanceAfter)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* ── Cancel ──────────────────────────────────────────── */}
                {b.hasSubscription && isAdmin && (
                    <section className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle px-5 py-4">
                        <p className="text-text-secondary">
                            Cancelling stops the next renewal. AI features keep working until the period ends.
                        </p>
                        <button
                            onClick={cancel}
                            disabled={busy !== null}
                            className="shrink-0 rounded-sm border border-border-default px-3 py-1.5 text-danger hover:bg-hover disabled:opacity-40"
                        >
                            {busy === 'cancel' ? 'Cancelling…' : 'Cancel plan'}
                        </button>
                    </section>
                )}
            </main>
        </div>
    );
}

/** Matches the breadcrumb bar used across the product. */
function Header({ org }: { org?: string }) {
    return (
        <header className="flex h-14 items-center gap-2 border-b border-border-subtle px-6">
            <Link href="/dashboard" className="text-text-secondary hover:text-text-primary">
                {org ?? 'Dashboard'}
            </Link>
            <span className="text-text-tertiary">›</span>
            <span className="font-medium text-text-primary">Usage &amp; billing</span>
        </header>
    );
}

function Chip({ children, tone }: { children: ReactNode; tone?: 'success' }) {
    const cls = tone === 'success'
        ? 'bg-success-subtle text-success'
        : 'bg-raised text-text-secondary';
    return (
        <span className={`rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-[0.05em] uppercase ${cls}`}>
            {children}
        </span>
    );
}
