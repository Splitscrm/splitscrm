// components/PricingPreview.tsx
// Reusable component to display extracted pricing data on both Add Partner and Partner Detail pages

"use client";

type PricingData = Record<string, any>;

function FeeSection({ title, data }: { title: string; data: Record<string, any> | null | undefined }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data).filter(([_, v]) => v && v !== "null" && v !== "$0.00" && v !== "0.00%" && v !== "N/A");
  if (entries.length === 0) return null;

  const formatLabel = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="text-gray-400">{formatLabel(key)}</span>
            <span className="text-white font-medium">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleSchedule({ pricing, index, onRemove }: { pricing: PricingData; index: number; onRemove?: (index: number) => void }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-700 pb-3">
        <div>
          {pricing.schedule_name && (
            <p className="text-white font-semibold text-base">{pricing.schedule_name}</p>
          )}
          {pricing.effective_date && (
            <p className="text-gray-400 text-xs mt-0.5">Effective: {pricing.effective_date}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pricing.pricing_model && (
            <span className="bg-blue-600/20 text-blue-400 px-2.5 py-1 rounded-full text-xs font-medium">
              {pricing.pricing_model.replace(/_/g, " ").toUpperCase()}
            </span>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(index)}
              className="text-red-500 hover:text-red-400 text-xs ml-2"
              title="Remove schedule"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Top-level rates */}
      {(pricing.interchange_plus || pricing.bank_sponsorship_bps) && (
        <div className="grid grid-cols-2 gap-4 bg-gray-900/50 rounded-lg p-3">
          {pricing.interchange_plus && (
            <div>
              <p className="text-gray-400 text-xs">Interchange+ Rate</p>
              <p className="text-white font-semibold">{pricing.interchange_plus}</p>
            </div>
          )}
          {pricing.bank_sponsorship_bps && (
            <div>
              <p className="text-gray-400 text-xs">Bank Sponsorship (BPS)</p>
              <p className="text-white font-semibold">{pricing.bank_sponsorship_bps}</p>
            </div>
          )}
        </div>
      )}

      {/* Fee sections */}
      <FeeSection title="Transaction Fees" data={pricing.transaction_fees} />
      <FeeSection title="Monthly Fees" data={pricing.monthly_fees} />
      <FeeSection title="Chargeback Fees" data={pricing.chargeback_fees} />
      <FeeSection title="Compliance Fees" data={pricing.compliance_fees} />
      <FeeSection title="Annual Fees" data={pricing.annual_fees} />
      <FeeSection title="Gateway Fees" data={pricing.gateway_fees} />
      <FeeSection title="ACH & Other Fees" data={pricing.other_fees} />
      <FeeSection title="Revenue Share" data={pricing.revenue_share} />
      <FeeSection title="Incentives" data={pricing.incentives} />

      {/* Additional products */}
      {pricing.additional_products && pricing.additional_products.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Additional Products</p>
          {pricing.additional_products.map((p: any, i: number) => (
            <p key={i} className="text-sm text-gray-300">{typeof p === "string" ? p : JSON.stringify(p)}</p>
          ))}
        </div>
      )}

      {/* Notes */}
      {pricing.notes && (
        <div className="border-t border-gray-700 pt-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-gray-400 text-sm">{pricing.notes}</p>
        </div>
      )}
    </div>
  );
}

export default function PricingPreview({ pricing, onRemove }: { pricing: PricingData | PricingData[]; onRemove?: (index: number) => void }) {
  if (!pricing) return null;

  const schedules = Array.isArray(pricing) ? pricing : [pricing];

  return (
    <div className="space-y-4">
      {schedules.map((schedule, index) => (
        <SingleSchedule key={index} pricing={schedule} index={index} onRemove={onRemove} />
      ))}
    </div>
  );
}