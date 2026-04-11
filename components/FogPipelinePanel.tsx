'use client';

import { useEffect, useMemo, useState } from 'react';
import { Radio, Server, Cloud, ArrowRight, Activity } from 'lucide-react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
import { buildPublicApiUrl, getLocalApiBase } from '@/lib/public-api-base';

type FogStatusPayload = {
  service?: string;
  fogNodeId?: string;
  fogInputMode?: string;
  cloudUrl?: string;
  mqttBrokerUrl?: string;
  mqttTopicFilter?: string;
  mqttToCloudTopic?: string | null;
  mqttPublishBrokerUrl?: string | null;
  sqsQueueConfigured?: boolean;
  sqsRegion?: string | null;
  sqsQueueName?: string | null;
  pipeline?: string;
  stats?: Record<string, unknown>;
  error?: string;
  hint?: string;
  attemptedUrl?: string;
};

function StatLine({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex justify-between gap-4 text-xs text-white/80">
      <span className="text-white/50">{label}</span>
      <span className="font-mono text-cyan-200/90 text-right break-all">{String(value)}</span>
    </div>
  );
}

export default function FogPipelinePanel() {
  const { localApiTunnelUrl } = useApiBackend();
  const fogStatusUrl = useMemo(() => {
    const direct = process.env.NEXT_PUBLIC_FOG_STATUS_URL?.trim();
    if (direct) return direct;
    const base = getLocalApiBase(undefined, localApiTunnelUrl || null);
    return buildPublicApiUrl('/api/fog/status', base);
  }, [localApiTunnelUrl]);

  const [data, setData] = useState<FogStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const url = fogStatusUrl;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const json = (await res.json()) as FogStatusPayload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ error: 'Request failed' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fogStatusUrl]);

  return (
    <div className="border border-emerald-500/25 rounded-xl p-6 backdrop-blur-sm bg-gradient-to-br from-emerald-950/20 to-slate-950/40">
      <div className="flex items-start gap-3 mb-4">
        <Activity className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-lg font-semibold text-white">Fog pipeline</h3>
          <p className="text-sm text-white/55 mt-1">
            Edge → MQTT (Mosquitto / IoT Core) or HTTP → fog → cloud (HTTP + optional SQS + optional MQTT publish).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-4 px-2 rounded-lg bg-black/25 border border-white/10 text-xs sm:text-sm">
        <span className="flex items-center gap-1.5 text-white/70">
          <Radio className="w-4 h-4 text-amber-400" />
          Edge / sensor
        </span>
        <ArrowRight className="w-4 h-4 text-white/30 hidden sm:block" />
        <span className="flex items-center gap-1.5 text-white/70">
          <Server className="w-4 h-4 text-cyan-400" />
          Mosquitto / broker
        </span>
        <ArrowRight className="w-4 h-4 text-white/30 hidden sm:block" />
        <span className="flex items-center gap-1.5 text-emerald-300 font-medium">Fog node</span>
        <ArrowRight className="w-4 h-4 text-white/30 hidden sm:block" />
        <span className="flex items-center gap-1.5 text-white/70">
          <Cloud className="w-4 h-4 text-violet-400" />
          Cloud (HTTP / SQS / MQTT)
        </span>
      </div>

      {loading && (
        <p className="text-sm text-white/45 mt-4 animate-pulse">Loading fog status…</p>
      )}

      {!loading && data?.error && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-200/90">
          <p className="font-medium">{data.error}</p>
          {data.hint && <p className="text-xs text-white/60 mt-1">{data.hint}</p>}
          {data.attemptedUrl && (
            <p className="text-xs font-mono text-white/40 mt-1 break-all">{data.attemptedUrl}</p>
          )}
        </div>
      )}

      {!loading && !data?.error && data?.service && (
        <div className="mt-4 space-y-3">
          <StatLine label="Fog node ID" value={data.fogNodeId} />
          <StatLine label="Input mode" value={data.fogInputMode} />
          <StatLine label="MQTT subscribe" value={data.mqttBrokerUrl} />
          <StatLine label="Topic filter" value={data.mqttTopicFilter} />
          <StatLine label="Cloud ingest" value={data.cloudUrl} />
          <StatLine label="SQS configured" value={data.sqsQueueConfigured ? 'yes' : 'no'} />
          {data.sqsQueueConfigured && (
            <>
              <StatLine label="SQS region" value={data.sqsRegion} />
              <StatLine label="SQS queue" value={data.sqsQueueName} />
            </>
          )}
          {data.mqttToCloudTopic && (
            <>
              <StatLine label="MQTT publish broker" value={data.mqttPublishBrokerUrl} />
              <StatLine label="Topic → cloud" value={data.mqttToCloudTopic} />
            </>
          )}
          {data.stats && typeof data.stats === 'object' && (
            <div className="pt-2 border-t border-white/10 space-y-1">
              <p className="text-xs text-white/45 mb-1">Counters</p>
              {data.sqsQueueConfigured && (
                <>
                  <StatLine
                    label="SQS messages sent"
                    value={(data.stats.sqsSent as number | undefined) ?? 0}
                  />
                  <StatLine
                    label="SQS send failures"
                    value={(data.stats.sqsFailure as number | undefined) ?? 0}
                  />
                </>
              )}
              {Object.entries(data.stats)
                .filter(([k]) => k !== 'sqsSent' && k !== 'sqsFailure')
                .map(([k, v]) => (
                  <StatLine key={k} label={k} value={v as string | number | boolean} />
                ))}
            </div>
          )}
        </div>
      )}

      {!loading && !data?.error && !data?.service && (
        <p className="text-sm text-white/45 mt-4">No fog status payload. Is the fog node running on port 4000?</p>
      )}

      <p className="text-xs text-white/35 mt-4">
        <code className="text-white/50">npm run dev</code> (same as <code className="text-white/50">dev:all</code>) — Next + fog + simulator over{' '}
        <span className="text-emerald-200/80">HTTP</span> (simulator POST → fog :4000 → app ingest); no local MQTT broker required. For AWS IoT MQTT, run{' '}
        <code className="text-white/50">npm run dev:iot</code> with <code className="text-white/50">MQTT_BROKER_URL</code> + PEM paths — see{' '}
        <span className="text-white/45">docs/AWS_IOT_CORE.md</span> and <span className="text-white/45">docs/MQTT_FLOW.md</span>.
      </p>
    </div>
  );
}
