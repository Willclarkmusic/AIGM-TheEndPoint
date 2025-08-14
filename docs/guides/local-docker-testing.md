# Local Docker Testing Guide

This guide helps you test the Docker container locally before deploying to Cloud Run.

## Prerequisites

- Docker installed and running
- Node.js and npm installed

## Quick Start

### 1. Build the Docker Image

```bash
cd frontend
docker build -t aigm-frontend .
```

### 2. Run the Container

```bash
# Run on default port 8080
docker run -p 8080:8080 aigm-frontend

# Or run on a different port (e.g., 3000)
docker run -p 3000:8080 aigm-frontend

# Run with environment variables
docker run -p 8080:8080 -e NODE_ENV=production aigm-frontend
```

### 3. Test the Application

Open your browser and navigate to:
- **Application**: http://localhost:8080
- **Health Check**: http://localhost:8080/health

### 4. Test with Cloud Run Port Environment Variable

Cloud Run injects a `PORT` environment variable. Test this behavior:

```bash
docker run -p 9000:9000 -e PORT=9000 aigm-frontend
```

Then test: http://localhost:9000

## Testing Commands

### Basic Functionality Test

```bash
# Test health endpoint
curl http://localhost:8080/health

# Test main application
curl -I http://localhost:8080

# Test static assets
curl -I http://localhost:8080/assets/
```

### Performance Testing

```bash
# Simple load test with Apache Bench (if installed)
ab -n 100 -c 10 http://localhost:8080/

# Test with curl timing
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8080/
```

Create `curl-format.txt`:
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

## Debugging

### View Container Logs

```bash
# Run container with logs visible
docker run -p 8080:8080 aigm-frontend

# Or run in background and view logs
docker run -d --name aigm-test -p 8080:8080 aigm-frontend
docker logs -f aigm-test
```

### Inspect Container

```bash
# Run container interactively
docker run -it --entrypoint /bin/sh aigm-frontend

# Or connect to running container
docker exec -it aigm-test /bin/sh
```

### Common Issues

1. **Port not accessible**: Ensure the port mapping is correct
2. **Assets not loading**: Check nginx configuration and build output
3. **Health check failing**: Verify nginx is starting correctly

## Cleanup

```bash
# Stop running container
docker stop aigm-test

# Remove container
docker rm aigm-test

# Remove image
docker rmi aigm-frontend
```

## Multi-stage Build Testing

Test individual stages:

```bash
# Build only the builder stage
docker build --target builder -t aigm-frontend:builder .

# Run the builder stage to check build output
docker run --rm aigm-frontend:builder ls -la /app/dist
```

This helps debug build issues without running the full production container.