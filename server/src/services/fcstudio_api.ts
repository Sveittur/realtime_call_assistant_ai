import fetch, { RequestInit, HeadersInit } from "node-fetch";

const BASE_URL = "https://api-msm-studio.com";
const DEVELOPMENT_TOKEN = "YOUR_TOKEN_HERE";

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  const normalized: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DEVELOPMENT_TOKEN}`,
  };

  if (!headers) return normalized;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
  } else if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      normalized[key] = value;
    });
  } else {
    // headers is Record<string, string>
    Object.entries(headers).forEach(([key, value]) => {
      normalized[key] = value;
    });
  }

  return normalized;
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const fetchOptions: RequestInit = {
    ...options,
    headers: normalizeHeaders(options.headers),
    // convert null body to undefined
    body: options.body === null ? undefined : options.body,
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, fetchOptions);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API request failed: ${res.status} ${res.statusText}\n${errText}`);
  }

  return res.json();
}

// Usage examples:
async function getEmployees() {
  return apiFetch("/barbers/barbershops/1");
}

async function getEmployeeServices(employeeId: number) {
  return apiFetch(`/services/barber/${employeeId}`);
}

async function getAvailability(employeeId: number, serviceId: number, date: string) {
  return apiFetch(`/calendars/availability/${employeeId}?service_id=${serviceId}&date=${date}`);
}

export { apiFetch, getEmployees, getEmployeeServices, getAvailability };
