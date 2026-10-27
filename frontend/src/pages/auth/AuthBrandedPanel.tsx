// ==============================================================================
// AssetVault: Modern Auth Branded Panel (Left Half)
// Animated floating asset and license cards with CSS keyframe animations,
// AssetVault logo, tagline, and 3 enterprise feature highlights.
// ==============================================================================

import React from 'react';
import {
  ShieldCheck,
  Package,
  KeyRound,
  Database,
  Lock,
  Award,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';

export const AuthBrandedPanel: React.FC = () => {
  return (
    <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 flex-col justify-between p-12 overflow-hidden border-r border-slate-800/80 select-none">
      {/* Ambient background glows & grid */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-cyan-600/15 blur-[100px] pointer-events-none" />
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Top: AssetVault Brand Header */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-tight flex items-center gap-1.5 font-mono">
              Asset<span className="text-indigo-400">Vault</span>
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                v2.0
              </span>
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-Tenant Digital Asset & License Management System
            </p>
          </div>
        </div>
      </div>

      {/* Middle: Floating Interactive Showcase Cards */}
      <div className="relative z-10 my-auto py-8 space-y-4 max-w-md w-full mx-auto">
        {/* Floating Card 1: Asset Catalog Card (Floating slow) */}
        <div className="animate-float-slow transform p-4 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-2xl shadow-indigo-950/50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">
                  Helvetica Now Pro Master Font
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  AST-009 &bull; Typography
                </span>
              </div>
            </div>
            <Badge variant="success" size="sm" dot>
              COMPLIANT
            </Badge>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Covered by Monotype Enterprise</span>
            <span className="font-mono text-emerald-400 font-semibold">Active License</span>
          </div>
        </div>

        {/* Floating Card 2: License Utilization Card (Floating medium with horizontal offset) */}
        <div className="animate-float-medium transform ml-6 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 shadow-2xl shadow-cyan-950/50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">
                  JetBrains All Products Pack
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ••••••••-9821
                </span>
              </div>
            </div>
            <Badge variant="warning" size="sm" dot>
              96% Used
            </Badge>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Seat Utilization</span>
              <span className="font-mono text-white font-bold">48 / 50 seats</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                style={{ width: '96%' }}
              />
            </div>
          </div>
        </div>

        {/* Floating Card 3: Enterprise Compliance & Cost Metric Card (Floating reverse) */}
        <div className="animate-float-reverse transform p-3.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-xl shadow-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                Enterprise Compliance Score
              </span>
              <span className="text-[10px] text-slate-400">
                Automatic trigger verification & audit log
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-emerald-400 font-mono">94%</span>
            <span className="text-[10px] text-slate-400 block font-semibold">Grade A</span>
          </div>
        </div>
      </div>

      {/* Bottom: Tagline & 3 Feature Highlights */}
      <div className="relative z-10 pt-4 border-t border-slate-800/80 space-y-3">
        <div className="grid grid-cols-1 gap-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                Automated Seat Quota Defense
              </span>
              <span className="text-[11px] text-slate-400 leading-tight block">
                Enforces contract allocations with PostgreSQL triggers and stored procedures.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                PostgreSQL Enterprise Views
              </span>
              <span className="text-[11px] text-slate-400 leading-tight block">
                Real-time license matrices, spend window functions, and materialized trends.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                Tenant Data Segregation & Auditing
              </span>
              <span className="text-[11px] text-slate-400 leading-tight block">
                Immutable RFC 4180 audit trail with strictly guarded tenant isolation boundaries.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthBrandedPanel;
