# Docker - Complete Guide

## What is Docker?

Docker is a containerization platform that allows you to package your application and all its dependencies into a standardized unit called a container. Containers are lightweight, portable, and ensure that your application runs the same way everywhere.

### Key Concepts

**Container** — A lightweight, standalone, executable package that includes everything needed to run an application: code, runtime, system tools, libraries, and settings.

**Image** — A blueprint for creating containers. It's a read-only template that contains all the instructions needed to create a container.

**Docker Hub** — A cloud-based repository where you can find and share Docker images. It's similar to GitHub but for container images.

**Registry** — A service that stores Docker images. Docker Hub is the default public registry.

## Installation

### On Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install docker.io
```

### On macOS

Download Docker Desktop from https://www.docker.com/products/docker-desktop. The installer includes Docker Engine, Docker CLI, and Docker Compose.

### On Windows

Download Docker Desktop for Windows from the official Docker website. Windows Pro/Enterprise editions are recommended for better performance.

## Basic Commands

### Running a Container

```bash
docker run -d --name my_container ubuntu:latest
```

Flags:
- `-d` : Run in detached mode (background)
- `--name` : Assign a name to the container
- `-p 8080:80` : Map port 8080 on host to port 80 in container
- `-v /host/path:/container/path` : Mount a volume

### Listing Containers

```bash
docker ps          # List running containers
docker ps -a       # List all containers (running and stopped)
```

### Stopping and Removing Containers

```bash
docker stop my_container        # Stop a running container
docker rm my_container          # Remove a stopped container
docker rm -f my_container       # Force remove a running container
```

### Viewing Logs

```bash
docker logs my_container
docker logs -f my_container     # Follow logs in real-time
```

## Working with Images

### Building an Image

Create a file named `Dockerfile`:

```dockerfile
FROM ubuntu:20.04

RUN apt-get update && apt-get install -y python3

COPY app.py /app/

WORKDIR /app

CMD ["python3", "app.py"]
```

Build the image:

```bash
docker build -t my_app:1.0 .
```

### Pulling Images

```bash
docker pull ubuntu:latest
docker pull nginx:1.21
```

### Listing Images

```bash
docker images
```

### Removing Images

```bash
docker rmi ubuntu:latest
```

## Docker Compose

Docker Compose allows you to define and run multiple containers as a single application.

### docker-compose.yml Example

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=True

  db:
    image: postgres:13
    environment:
      - POSTGRES_PASSWORD=secret
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Running with Docker Compose

```bash
docker-compose up              # Start all services
docker-compose up -d           # Start in background
docker-compose down            # Stop and remove services
docker-compose logs            # View logs
```

## Networking

### Bridge Network (Default)

Containers are connected to a virtual network and can communicate with each other by name.

```bash
docker network create my_network
docker run --network my_network --name app1 my_app:1.0
docker run --network my_network --name app2 my_app:1.0
```

Containers can ping each other: `ping app1` from inside app2.

### Port Mapping

```bash
docker run -p 8080:80 nginx  # Map host port 8080 to container port 80
```

## Volumes and Data Persistence

### Named Volumes

```bash
docker volume create my_volume
docker run -v my_volume:/app/data my_app:1.0
```

### Bind Mounts

```bash
docker run -v /host/path:/container/path my_app:1.0
```

### Volume Inspection

```bash
docker volume ls
docker volume inspect my_volume
docker volume rm my_volume
```

## Environment Variables

Pass environment variables to containers:

```bash
docker run -e DATABASE_URL=postgresql://localhost/db my_app:1.0
docker run -e VAR1=value1 -e VAR2=value2 my_app:1.0
```

Or use a file:

```bash
docker run --env-file .env my_app:1.0
```

## Resource Limits

Limit CPU and memory usage:

```bash
docker run --cpus=1.5 --memory=512m my_app:1.0
```

## Health Checks

Define a health check in Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1
```

Check container health:

```bash
docker ps  # STATUS column shows (healthy) or (unhealthy)
```

## Best Practices

1. **Use specific base image versions**, not `latest` tag in production
2. **Minimize layer count** by combining RUN commands
3. **Use .dockerignore** to exclude unnecessary files
4. **Run as non-root user** for security
5. **Keep images small** by removing unnecessary packages
6. **Use multi-stage builds** to reduce final image size

Example multi-stage build:

```dockerfile
FROM python:3.9 as builder
COPY requirements.txt .
RUN pip install --user -r requirements.txt

FROM python:3.9
COPY --from=builder /root/.local /root/.local
COPY app.py .
CMD ["python", "app.py"]
```

## Troubleshooting

### Container exits immediately

```bash
docker logs container_name     # Check error messages
docker run -it image_name bash # Run interactively for debugging
```

### Port already in use

```bash
docker run -p 9090:8000 my_app:1.0  # Use different host port
```

### Out of disk space

```bash
docker system prune      # Remove unused containers, images, volumes
docker system df         # Check Docker disk usage
```

## Performance Metrics

Monitor container performance:

```bash
docker stats              # Show CPU, memory, network usage
docker stats container_name
```

## Conclusion

Docker simplifies application deployment and ensures consistency across environments. Master these fundamentals, and you'll be able to containerize any application efficiently.
