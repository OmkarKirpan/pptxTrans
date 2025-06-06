import { TranslationSession } from '../../src/model';

export class MockSupabaseQueryBuilder {
  private _from: string = '';
  private _select: string = '*';
  private _filters: Record<string, any> = {};
  private _orderBy: { column: string; ascending: boolean } | null = null;
  private _range: { from: number; to: number } | null = null;
  private _single: boolean = false;
  private _count: 'exact' | null = null;

  constructor(private mockData: any[] = [], private mockError: any = null) {}

  from(table: string) {
    this._from = table;
    return this;
  }

  select(columns: string, options?: { count?: 'exact' }) {
    this._select = columns;
    if (options?.count) {
      this._count = options.count;
    }
    return this;
  }

  eq(column: string, value: any) {
    this._filters[column] = { type: 'eq', value };
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this._orderBy = { column, ascending: options.ascending };
    return this;
  }

  range(from: number, to: number) {
    this._range = { from, to };
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  insert(data: any) {
    return this;
  }

  update(data: any) {
    return this;
  }

  delete() {
    return this;
  }

  async then() {
    if (this.mockError) {
      return { data: null, error: this.mockError, count: null };
    }

    let filteredData = [...this.mockData];

    // Apply filters
    Object.entries(this._filters).forEach(([column, filter]) => {
      if (filter.type === 'eq') {
        filteredData = filteredData.filter(item => item[column] === filter.value);
      }
    });

    // Apply ordering
    if (this._orderBy) {
      filteredData.sort((a, b) => {
        const aVal = a[this._orderBy!.column];
        const bVal = b[this._orderBy!.column];
        const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return this._orderBy!.ascending ? result : -result;
      });
    }

    const count = filteredData.length;

    // Apply range
    if (this._range) {
      filteredData = filteredData.slice(this._range.from, this._range.to + 1);
    }

    // Handle single
    if (this._single) {
      if (filteredData.length === 0) {
        return { 
          data: null, 
          error: { code: 'PGRST116', message: 'No rows found' }, 
          count: null 
        };
      }
      return { data: filteredData[0], error: null, count: this._count ? count : null };
    }

    return { data: filteredData, error: null, count: this._count ? count : null };
  }
}

export class MockSupabaseClient {
  constructor(
    private mockSessions: TranslationSession[] = [],
    private mockError: any = null,
    private authUser: any = null,
    private authError: any = null
  ) {}

  from(table: string) {
    return new MockSupabaseQueryBuilder(this.mockSessions, this.mockError);
  }

  get auth() {
    return {
      getUser: async (token?: string) => {
        if (this.authError) {
          return { data: { user: null }, error: this.authError };
        }
        return { data: { user: this.authUser }, error: null };
      }
    };
  }

  // Helper methods for test setup
  setMockSessions(sessions: TranslationSession[]) {
    this.mockSessions = sessions;
  }

  setMockError(error: any) {
    this.mockError = error;
  }

  setAuthUser(user: any) {
    this.authUser = user;
  }

  setAuthError(error: any) {
    this.authError = error;
  }

  clearMocks() {
    this.mockSessions = [];
    this.mockError = null;
    this.authUser = null;
    this.authError = null;
  }
}

export const createMockSupabase = () => new MockSupabaseClient();