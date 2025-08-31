# TerraHost

Geospatial data processing and management platform for satellite imagery and GeoTIFF files.

## Project Structure

```
TerraHost/
├── frontend/          # Next.js React application
├── backend/           # Node.js Express API
└── docker-compose.yaml
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd TerraHost
```

2. Setup Frontend
```bash
cd frontend
npm install
```

3. Setup Backend
```bash
cd backend
npm install
```

### Development

#### Run with Docker (Recommended)
```bash
# Build and run all services
docker-compose up --build

# Run in background
docker-compose up -d
```

#### Run Manually

Frontend:
```bash
cd frontend
npm run dev
```
Access at: http://localhost:3000

Backend:
```bash
cd backend
npm run dev
```
Access at: http://localhost:8000

### API Endpoints

- `GET /` - Welcome message
- `GET /health` - Health check
- `GET /api` - API information

### Environment Configuration

Copy environment files and configure:
```bash
cp backend/env.example backend/.env
```

### Docker Commands

```bash
# Frontend only
cd frontend
npm run docker:build
npm run docker:run

# Full stack
npm run docker:up
npm run docker:down
```

## Features

### Current
- Next.js frontend with satellite-themed UI
- Express.js REST API
- Docker containerization
- Health monitoring

### Planned
- GeoTIFF file upload and processing
- Satellite imagery layer extraction
- PostGIS spatial database integration
- Python-based geospatial processing
- Interactive map visualization

## Technology Stack

### Frontend
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Express.js
- PostgreSQL + PostGIS (planned)
- Python + GDAL (planned)

### Infrastructure
- Docker
- Docker Compose
- Nginx (planned)

## Development

### Project Guidelines
- Use TypeScript for frontend
- Follow OOP patterns in backend
- Implement proper error handling
- Write clean, maintainable code

### Adding New Features
1. Create feature branch
2. Implement changes
3. Test locally
4. Submit pull request

## License

MIT License
