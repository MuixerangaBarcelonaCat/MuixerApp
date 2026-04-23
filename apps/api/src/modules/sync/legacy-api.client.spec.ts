import { LegacyApiClient } from './legacy-api.client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LegacyApiClient', () => {
  let client: LegacyApiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    process.env.LEGACY_API_URL = 'https://test.example.com';
    process.env.LEGACY_API_USERNAME = 'testuser';
    process.env.LEGACY_API_PASSWORD = 'testpass';

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    client = new LegacyApiClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const loginSuccessMocks = () => {
    mockAxiosInstance.get.mockResolvedValueOnce({
      status: 200,
      headers: { 'set-cookie': ['PHPSESSID=abc123; path=/'] },
      data: '',
    });
    mockAxiosInstance.post.mockResolvedValueOnce({
      status: 302,
      headers: { location: '/home', 'set-cookie': [] },
      data: '',
    });
    mockAxiosInstance.get.mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: '<html>tancar sessió</html>',
    });
  };

  describe('login', () => {
    it('should login successfully and store session cookie', async () => {
      loginSuccessMocks();

      await client.login();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/',
        expect.stringContaining('username=testuser'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'PHPSESSID=abc123',
          }),
        }),
      );
    });

    it('should throw error if login fails (no "tancar" in response)', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: '',
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { location: '/home' },
        data: '',
      });

      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: '<html>no logout button here</html>',
      });

      await expect(client.login()).rejects.toThrow('Login failed: "tancar" not found in response');
    });

    it('should include User-Agent header', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
          }),
        }),
      );
    });
  });

  describe('getCastellers', () => {
    it('should fetch and clean castellers data', async () => {
      loginSuccessMocks();

      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          rows: [
            {
              '0': 'ignore',
              id: '1',
              nom: '<b>Joan</b>',
              cognom1: 'Garcia&nbsp;',
              mote: 'Joani',
              posicio: 'PRIMERES',
            },
            {
              '0': 'ignore',
              id: '2',
              nom: 'Maria',
              cognom1: 'Lopez',
              mote: '',
              posicio: 'VENTS + LATERALS',
            },
          ],
        },
      });

      const result = await client.getCastellers();

      expect(result).toHaveLength(2);
      expect(result[0].nom).toBe('Joan');
      expect(result[0].cognom1).toBe('Garcia');
      expect(result[0]).not.toHaveProperty('0');
    });

    it('should strip HTML tags and entities', async () => {
      loginSuccessMocks();

      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: {
          rows: [
            {
              id: '1',
              nom: '<strong>Test&amp;Name</strong>',
              cognom1: 'Surname&nbsp;Test',
            },
          ],
        },
      });

      const result = await client.getCastellers();

      expect(result[0].nom).toBe('Test&Name');
      expect(result[0].cognom1).toBe('Surname Test');
    });

    it('should throw error if response format is invalid', async () => {
      loginSuccessMocks();

      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { invalid: 'format' },
      });

      await expect(client.getCastellers()).rejects.toThrow('Invalid response format from /api/castellers');
    });
  });
});
