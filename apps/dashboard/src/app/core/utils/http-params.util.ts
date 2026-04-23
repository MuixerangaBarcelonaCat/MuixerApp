import { HttpParams } from '@angular/common/http';

export function buildHttpParams(params: Record<string, unknown> | object): HttpParams {
  let httpParams = new HttpParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((val) => {
          httpParams = httpParams.append(key, String(val));
        });
      } else {
        httpParams = httpParams.set(key, String(value));
      }
    }
  }

  return httpParams;
}
