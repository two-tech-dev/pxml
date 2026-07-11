export interface DiagnosticsLog {
  message: string;
  statusCode?: number;
  stack?: string;
}

export class PxmlDiagnostics {
  /**
   * Evaluates runtime error logs/diagnostics and maps them heuristically to a node flow
   */
  static diagnoseHeuristic(log: DiagnosticsLog): { flow: string; suspectedType: string } | null {
    const msg = log.message.toLowerCase() + ' ' + (log.stack || '').toLowerCase();
    
    // Heuristic mappings
    if (log.statusCode === 401 || log.statusCode === 403 || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('jwt') || msg.includes('token')) {
      return { flow: 'auth', suspectedType: 'middleware' };
    }
    if (msg.includes('cookie') || msg.includes('session')) {
      return { flow: 'session', suspectedType: 'middleware' };
    }
    if (msg.includes('cors') || msg.includes('origin') || log.statusCode === 405) {
      return { flow: 'api', suspectedType: 'api-route' };
    }
    if (msg.includes('prisma') || msg.includes('database') || msg.includes('db ') || msg.includes('query') || msg.includes('unique constraint')) {
      return { flow: 'db', suspectedType: 'db-model' };
    }

    return null;
  }
}
