import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface LegacyPerson {
  id: string;
  nom: string;
  cognom1: string;
  cognom2: string;
  mote: string;
  posicio: string;
  te_app: string;
  email: string;
  data_naixement: string;
  telefon: string;
  instant_camisa: string;
  alcada_espatlles: string;
  revisat: string;
  estat_acollida: string;
  llistes: string;
  tecnica: string;
  propi: string;
  lesionat: string;
  n_assistencies: string;
  observacions: string;
  import_quota: string;
}

@Injectable()
export class LegacyApiClient {
  private readonly logger = new Logger(LegacyApiClient.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private sessionCookie: string | null = null;

  constructor() {
    this.baseUrl = process.env.LEGACY_API_URL || '';
    this.username = process.env.LEGACY_API_USERNAME || '';
    this.password = process.env.LEGACY_API_PASSWORD || '';

    this.logger.log(`Legacy API URL: ${this.baseUrl ? '✓ Configured' : '✗ Missing'}`);
    this.logger.log(`Legacy API credentials: ${this.username && this.password ? '✓ Configured' : '✗ Missing'}`);

    if (!this.baseUrl) {
      this.logger.warn(
        'LEGACY_API_URL not configured. Sync functionality will be disabled.',
      );
    }

    if (!this.username || !this.password) {
      this.logger.warn(
        'LEGACY_API credentials not configured. Sync functionality will be disabled.',
      );
    }

    this.client = axios.create({
      baseURL: this.baseUrl || undefined,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ca,en;q=0.5',
      },
      maxRedirects: 5,
      validateStatus: () => true,
      withCredentials: true,
    });
  }

  async login(): Promise<void> {
    if (!this.baseUrl || !this.username || !this.password) {
      throw new Error(
        'Legacy API credentials not configured. Please set LEGACY_API_URL, LEGACY_API_USERNAME, and LEGACY_API_PASSWORD in .env',
      );
    }

    this.logger.log('Logging in to legacy API...');
    this.logger.debug(`Base URL: ${this.baseUrl}`);
    this.logger.debug(`Username: ${this.username}`);

    // Step 1: Get initial cookies
    const initialResp = await this.client.get('/');
    this.logger.debug(`Initial response status: ${initialResp.status}`);
    
    const cookies = initialResp.headers['set-cookie'];
    if (cookies) {
      const phpSessId = cookies.find((c) => c.startsWith('PHPSESSID='));
      if (phpSessId) {
        this.sessionCookie = phpSessId.split(';')[0];
        this.logger.debug(`Session cookie obtained: ${this.sessionCookie.substring(0, 20)}...`);
      } else {
        this.logger.warn('No PHPSESSID cookie found in initial response');
      }
    } else {
      this.logger.warn('No cookies in initial response');
    }

    // Step 2: Login (returns 302 redirect)
    const loginResp = await this.client.post(
      '/',
      new URLSearchParams({
        username: this.username,
        password: this.password,
        submitted: '1',
        email_confirm: '',
        phone: '',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: this.sessionCookie || '',
          Referer: this.baseUrl + '/',
          Origin: this.baseUrl,
        },
        maxRedirects: 0, // Don't follow redirects automatically
      },
    );

    this.logger.debug(`Login response status: ${loginResp.status}`);
    
    // Update session cookie if new one is provided
    const loginCookies = loginResp.headers?.['set-cookie'];
    if (loginCookies) {
      const phpSessId = loginCookies.find((c) => c.startsWith('PHPSESSID='));
      if (phpSessId) {
        this.sessionCookie = phpSessId.split(';')[0];
        this.logger.debug(`Session cookie updated after login`);
      }
    }

    // Check if login was successful (should be 302 redirect)
    if (loginResp.status !== 302 && loginResp.status !== 301) {
      this.logger.warn(`Expected 302 redirect, got ${loginResp.status}`);
      const responseText = typeof loginResp.data === 'string' 
        ? loginResp.data.toLowerCase() 
        : '';
      
      if (responseText.includes('username') && responseText.includes('password')) {
        throw new Error('Login failed: Still on login page. Check credentials.');
      }
    }

    // Step 3: Follow redirect to /home (or wherever it redirects)
    const redirectLocation = loginResp.headers?.location || '/home';
    this.logger.debug(`Following redirect to: ${redirectLocation}`);

    const homeResp = await this.client.get(redirectLocation, {
      headers: {
        Cookie: this.sessionCookie || '',
      },
      maxRedirects: 5, // Allow multiple redirects from here
    });

    this.logger.debug(`Home response status: ${homeResp.status}`);

    // Check for success indicators in the final page
    const responseText = typeof homeResp.data === 'string' 
      ? homeResp.data.toLowerCase() 
      : JSON.stringify(homeResp.data).toLowerCase();

    this.logger.debug(`Final response length: ${responseText.length} chars`);

    const hasLogoutButton = responseText.includes('tancar');
    const isLoginPage = responseText.includes('username') && responseText.includes('password') && responseText.includes('submitted');

    this.logger.debug(`Response contains "tancar": ${hasLogoutButton}`);
    this.logger.debug(`Response is login page: ${isLoginPage}`);

    // If we have the logout button, login was successful
    if (hasLogoutButton) {
      this.logger.log('✓ Login successful');
      return;
    }

    // If we're still on the login page, credentials are wrong
    if (isLoginPage) {
      throw new Error('Login failed: Still on login page after redirect. Check credentials.');
    }

    // Otherwise, something unexpected happened
    const preview = responseText.substring(0, 500);
    this.logger.debug(`Response preview: ${preview}`);
    throw new Error('Login failed: "tancar" not found in response after redirect.');
  }

  async getCastellers(): Promise<LegacyPerson[]> {
    if (!this.sessionCookie) {
      await this.login();
    }

    this.logger.log('Fetching castellers from legacy API...');

    const resp = await this.client.get('/api/castellers', {
      headers: {
        Cookie: this.sessionCookie || '',
      },
    });

    const data = resp.data;
    if (!data.rows || !Array.isArray(data.rows)) {
      throw new Error('Invalid response format from /api/castellers');
    }

    const cleaned = data.rows.map((row: Record<string, unknown>) => {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key === '0') continue;
        result[key] = this.stripHtml(String(value || ''));
      }
      return result as unknown as LegacyPerson;
    });

    this.logger.log(`Fetched ${cleaned.length} castellers`);

    await this.delay(200);

    return cleaned;
  }

  private stripHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
