import { HttpParams } from '@angular/common/http';

/**
 * Converteix un objecte de filtres/paràmetres en `HttpParams` per a les crides a l'API.
 * Ignora automàticament els valors `undefined`, `null` i cadenes buides.
 * Els arrays s'afegeixen com a múltiples paràmetres del mateix nom (compatible amb `class-validator` al backend).
 */
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
