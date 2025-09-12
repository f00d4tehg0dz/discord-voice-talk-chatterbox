#!/bin/bash

# Set your Docker Hub username
DOCKER_USERNAME="f00d4tehg0dz"
IMAGE_NAME="ai-voice-assistant"
TAG="latest"

# Function to handle errors
handle_error() {
    echo "Error: $1"
    exit 1
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    handle_error "Docker is not running. Please start Docker and try again."
fi

# Build the application image
echo "Building application image..."
if ! docker build -f Dockerfile.app -t ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG} .; then
    handle_error "Failed to build the Docker image"
fi

# Verify the image was created
if ! docker images | grep -q "${DOCKER_USERNAME}/${IMAGE_NAME}"; then
    handle_error "Image was not created successfully"
fi

# Tag the image
echo "Tagging image..."
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG} ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

# Login to Docker Hub (if not already logged in)
echo "Checking Docker Hub login..."
if ! docker info | grep -q "Username"; then
    echo "Please login to Docker Hub:"
    docker login
fi

# Push to Docker Hub
echo "Pushing to Docker Hub..."
if ! docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}; then
    handle_error "Failed to push image to Docker Hub"
fi

if ! docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest; then
    handle_error "Failed to push latest tag to Docker Hub"
fi

echo "Build and push completed successfully!"
echo "Image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}"
echo "You can now deploy using: docker-compose -f docker-compose.prod.yml up -d" 