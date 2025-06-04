<!-- productContext.md -->

# Product Context: Audit Service

## 1. Why This Service Exists
The Audit Service addresses critical needs in the PowerPoint translation workflow:

### Transparency & Accountability
- **Track All Changes**: Every edit, merge, reorder, comment, and export action is logged
- **Who Did What**: Clear attribution of actions to specific users
- **When It Happened**: Precise timestamps for forensic analysis
- **What Changed**: Detailed context about each modification

### Compliance & Governance
- Organizations need audit trails for:
  - Quality assurance reviews
  - Dispute resolution
  - Training and improvement
  - Regulatory compliance (if applicable)

### User Experience Benefits
- **History View**: Users can see the evolution of translations
- **Undo Context**: Understanding what was changed helps reversal decisions
- **Collaboration Insights**: See who contributed what to the translation
- **Progress Tracking**: Visualize session activity over time

## 2. Problems This Service Solves

### Before Audit Service
- No visibility into translation history
- Difficult to track down errors or issues
- No way to attribute changes to specific users
- Manual tracking via spreadsheets or emails
- Lost context when multiple reviewers collaborate

### With Audit Service
- Complete, queryable history for every session
- Instant access to who changed what and when
- Automated tracking with zero manual effort
- Standardized audit format across all actions
- Performance-optimized retrieval with caching

## 3. Service Boundaries

### What It Does
- Retrieves audit log entries from Supabase
- Validates access permissions (owner or shared)
- Paginates results for large histories
- Caches authentication tokens for performance
- Provides consistent API responses

### What It Doesn't Do
- Write or modify audit entries (read-only)
- Generate audit entries (done by action services)
- Store audit data (lives in Supabase)
- Aggregate or analyze audit data (future service)
- Real-time streaming of audit events

## 4. Integration Points

### Upstream Dependencies
- **Supabase Auth**: JWT token validation
- **Supabase Database**: audit_logs table queries
- **Session Service**: Validate session ownership
- **Share Service**: Validate share token access

### Downstream Consumers
- **Frontend History Page**: Display audit timeline
- **Export Service**: Include audit summary in exports
- **Analytics Service**: (future) Aggregate audit data
- **Admin Dashboard**: (future) Monitor system activity

## 5. Value Metrics
- **Response Time**: < 200ms for typical queries
- **Cache Hit Rate**: > 90% for token validation
- **Availability**: 99.9% uptime target
- **Query Performance**: Handles 1000+ entries efficiently
- **Security**: Zero unauthorized access incidents

--- 