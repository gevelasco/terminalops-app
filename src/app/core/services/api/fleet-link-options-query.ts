export function buildFleetLinkOptionsQuery(params?: {
  search?: string;
  id?: string;
  limit?: number;
}): string {
  const query = new URLSearchParams();
  const search = params?.search?.trim();
  if (search) {
    query.set('search', search);
  }
  const id = params?.id?.trim();
  if (id) {
    query.set('id', id);
  }
  if (params?.limit != null) {
    query.set('limit', String(params.limit));
  }
  return query.toString();
}
