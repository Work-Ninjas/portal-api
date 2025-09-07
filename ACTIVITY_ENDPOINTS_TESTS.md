# Activity Endpoints Tests

## Pre-requisites

**IMPORTANTE**: Antes de ejecutar estas pruebas, los siguientes scripts SQL deben ejecutarse en la base de datos:

1. `sql/01_activity_enum.sql` - Crear ENUM activity_entity_type
2. `sql/02_activity_view.sql` - Crear vista activity_view  
3. `sql/03_api_list_activity.sql` - Crear función api_list_activity
4. `sql/04_api_get_activity.sql` - Crear función api_get_activity

## Environment Variables

- **API_KEY**: `dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG`
- **BASE_URL**: `https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io`

## Test Cases

### 1. GET /v1/activity - List all activities

#### Basic listing
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?limit=2"
```
**Expected**: 200 with activity list, pagination metadata

#### With author filter
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?author=System&limit=2"
```
**Expected**: 200 with system activities only

#### With text search
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?q=milestone&limit=2"
```
**Expected**: 200 with activities containing "milestone"

#### With activity type filter
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?activity_type=system&limit=2"
```
**Expected**: 200 with system activities only

### 2. GET /v1/jobs/:jobId/activity - Job-specific activities

#### Valid job ID
```bash
# Get a job ID first
JOB_ID=$(curl -s -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
         "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/jobs?limit=1" | \
         grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/jobs/$JOB_ID/activity?limit=2"
```
**Expected**: 200 with activities for that specific job

#### Invalid job ID format
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/jobs/invalid-id/activity"
```
**Expected**: 400 Bad Request - Invalid job ID format

### 3. GET /v1/activity/:id - Get single activity

#### Valid activity (need to get an ID from previous test)
```bash
# Get an activity ID first
ACTIVITY_ID=$(curl -s -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
              "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?limit=1" | \
              grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity/$ACTIVITY_ID"
```
**Expected**: 200 with single activity details

#### Invalid activity ID
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity/invalid-id"
```
**Expected**: 400 Bad Request - Invalid activity ID format

#### Non-existent activity ID
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity/00000000-0000-0000-0000-000000000000"
```
**Expected**: 404 Not Found - Activity not found

### 4. Validation Tests

#### Invalid parameters - entity_type without entity_id
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?entity_type=job"
```
**Expected**: 400 Bad Request - Both entity_type and entity_id must be provided together

#### Invalid activity_type
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?activity_type=invalid"
```
**Expected**: 422 Validation Failed - Invalid activity_type

#### Invalid sort direction
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?dir=invalid"
```
**Expected**: 422 Validation Failed - Invalid sort direction

### 5. Pagination Tests

#### First page
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?limit=5&offset=0"
```
**Expected**: 200 with 5 items (if available), has_more: true/false

#### Second page
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?limit=5&offset=5"
```
**Expected**: 200 with next 5 items

### 6. Sorting Tests

#### Sort by created_at ascending
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?sort=created_at&dir=asc&limit=3"
```
**Expected**: 200 with activities sorted by creation date (oldest first)

#### Sort by author
```bash
curl -H "Authorization: Bearer dhp_live_aIfcKNdS_1uAyL3HABCCTZ4rEiIOCSTDDqxGr2ynG" \
     -H "Accept: application/json" \
     "https://portal-api-prod.braveflower-6eb9a63a.eastus.azurecontainerapps.io/v1/activity?sort=author&limit=3"
```
**Expected**: 200 with activities sorted by author name

### 7. Expected Response Format

All successful responses should include:

```json
{
  "data": [
    {
      "id": "uuid",
      "entity_type": "job|contact", 
      "entity_id": "uuid",
      "author": "string",
      "body_html": "string",
      "body_text": "string", 
      "occurred_at": "ISO8601 timestamp",
      "activity_type": "user|system",
      "priority": "low|normal|high",
      "created_at": "ISO8601 timestamp",
      "updated_at": "ISO8601 timestamp",
      "contact_id": "uuid|null"
    }
  ],
  "total": 0,
  "limit": 25,
  "offset": 0,
  "has_more": false
}
```

### 8. Error Response Format

All error responses should follow:

```json
{
  "type": "https://httpstatuses.com/400",
  "title": "Bad Request",
  "status": 400,
  "code": "BAD_REQUEST", 
  "detail": "Error message",
  "traceId": "uuid"
}
```

## Test Execution Notes

1. **Database Setup Required**: All SQL scripts must be executed first
2. **Data Dependency**: Tests assume message data exists in the database
3. **Sequential Testing**: Some tests depend on data from previous tests
4. **Tenant Isolation**: All tests use the same API key (same tenant)
5. **Rate Limiting**: Respect the 420 requests/minute limit

## Success Criteria

- All endpoints return 200 for valid requests
- Proper error codes for invalid requests (400, 404, 422)
- Pagination works correctly
- Filtering and sorting work as expected
- Response format matches specification
- Tenant isolation is maintained