import { ProviderError, type TrackingProvider, type TrackingSnapshot } from './types.js';

const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

export class Track17Provider implements TrackingProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.baseUrl = (env.TRACK17_API_BASE_URL || 'https://api.17track.net/track/v2.2').replace(/\/$/, '');
    this.apiKey = env.TRACK17_API_KEY || '';
  }

  private async call(path: string, body: unknown) {
    if (!this.apiKey) throw new ProviderError('17TRACK API key is not configured', 'not_configured');
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${path}`, {
        method: 'POST', headers: { '17token': this.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ProviderError(error instanceof Error ? error.message : '17TRACK request failed', 'network_error', undefined, true);
    }
    const result = asObject(await response.json().catch(() => ({})));
    if (!response.ok) throw new ProviderError(`17TRACK request failed (${response.status})`, 'provider_error', response.status, response.status === 429 || response.status >= 500);
    return result;
  }

  async register(number: string): Promise<void> {
    await this.call('register', [{ number }]);
  }

  async get(number: string): Promise<TrackingSnapshot> {
    const raw = await this.call('gettrackinfo', [{ number }]);
    const data = asObject(raw.data);
    const accepted = Array.isArray(data.accepted) ? asObject(data.accepted[0]) : {};
    const info = asObject(accepted.track_info);
    const tracking = asObject(info.tracking);
    const providers = Array.isArray(tracking.providers) ? tracking.providers.map(asObject) : [];
    const events = providers.flatMap((provider) => {
      const providerEvents = Array.isArray(provider.events) ? provider.events.map(asObject) : [];
      return providerEvents.map((event) => ({
        id: event.id == null ? undefined : String(event.id),
        time: String(event.time_iso || event.time_utc || ''),
        description: String(event.description || ''),
        location: event.location == null ? undefined : String(event.location),
      }));
    }).sort((left, right) => right.time.localeCompare(left.time));
    const latest = asObject(info.latest_status);
    const carrier = asObject(asObject(providers[0]).provider);
    return { number, carrier: carrier.name == null ? undefined : String(carrier.name), status: latest.status == null ? undefined : String(latest.status), events, raw };
  }
}
