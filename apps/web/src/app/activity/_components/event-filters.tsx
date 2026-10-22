"use client";

import { useRouter } from "next/navigation";

const TYPES = [
  "upload",
  "download",
  "mkdir",
  "mv",
  "rm",
  "share",
  "send",
  "receive",
  "login",
  "device_approved",
  "device_revoked",
  "device_token_reuse",
  "google_connected",
  "google_disconnected",
];

export function EventFilters({
  deviceList,
  current,
}: {
  deviceList: { id: string; name: string }[];
  current: { type?: string; device?: string };
}) {
  const router = useRouter();

  return (
    <form
      onChange={(event) => {
        const form = event.currentTarget;
        const data = new FormData(form);
        const query = new URLSearchParams();
        const type = String(data.get("type") ?? "");
        const device = String(data.get("device") ?? "");
        if (type) query.set("type", type);
        if (device) query.set("device", device);
        router.push(query.size > 0 ? `/activity?${query}` : "/activity");
      }}
      className="flex flex-wrap gap-3 text-sm"
    >
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Type</span>
        <select
          name="type"
          defaultValue={current.type ?? ""}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Device</span>
        <select
          name="device"
          defaultValue={current.device ?? ""}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All</option>
          {deviceList.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
