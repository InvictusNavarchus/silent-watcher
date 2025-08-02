# Deployment Guide

This guide covers various deployment options for Silent Watcher in production environments.

## Prerequisites

- **Node.js 20.19+** or **22.12+**
- **2GB+ RAM** recommended
- **10GB+ disk space** for data storage
- **Stable internet connection**
- **WhatsApp account** for bot authentication

## Environment Setup

### 1. System Dependencies

**Ubuntu/Debian:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install build tools
sudo apt-get install -y build-essential python3 python3-pip

# Install PM2 globally
sudo npm install -g pm2
```

**CentOS/RHEL:**
```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install build tools
sudo yum groupinstall -y "Development Tools"
sudo yum install -y python3 python3-pip

# Install PM2 globally
sudo npm install -g pm2
```

### 2. User Setup

```bash
# Create dedicated user
sudo useradd -m -s /bin/bash silentbot
sudo usermod -aG sudo silentbot

# Switch to user
sudo su - silentbot
```

### 3. Application Setup

```bash
# Clone repository
git clone https://github.com/your-org/silent-watcher.git
cd silent-watcher

# Install dependencies
npm run setup

# Build application
npm run build:all

# Copy environment file
cp .env.example .env
nano .env  # Configure your settings
```

## Deployment Methods

## Method 1: PM2 (Recommended)

PM2 is a production process manager for Node.js applications.

### Installation & Setup

```bash
# Install PM2 globally
npm install -g pm2

# Start application
npm run pm2:start

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions provided by the command
```

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs silent-watcher

# Restart application
pm2 restart silent-watcher

# Stop application
pm2 stop silent-watcher

# Delete application
pm2 delete silent-watcher

# Monitor resources
pm2 monit
```

### PM2 Configuration

The `ecosystem.config.js` file contains PM2 configuration:

```javascript
module.exports = {
  apps: [{
    name: 'silent-watcher',
    script: 'dist/main.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## Method 2: Systemd Service

Create a systemd service for automatic startup and management.

### Service File

Create `/etc/systemd/system/silent-watcher.service`:

```ini
[Unit]
Description=Silent Watcher WhatsApp Bot
After=network.target
Wants=network.target

[Service]
Type=simple
User=silentbot
Group=silentbot
WorkingDirectory=/home/silentbot/silent-watcher
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=silent-watcher
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/silentbot/silent-watcher/data

[Install]
WantedBy=multi-user.target
```

### Service Management

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable silent-watcher

# Start service
sudo systemctl start silent-watcher

# Check status
sudo systemctl status silent-watcher

# View logs
sudo journalctl -u silent-watcher -f

# Restart service
sudo systemctl restart silent-watcher
```

## Method 3: Docker

### Using Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/your-org/silent-watcher.git
cd silent-watcher

# Copy environment file
cp .env.example .env
nano .env  # Configure your settings

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Docker Deployment

```bash
# Build image
docker build -t silent-watcher .

# Create data directory
mkdir -p ./data

# Run container
docker run -d \
  --name silent-watcher \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/.env:/app/.env:ro \
  silent-watcher

# View logs
docker logs -f silent-watcher
```

### Docker with Nginx

Use the provided `docker-compose.yml` with nginx profile:

```bash
# Start with Nginx reverse proxy
docker-compose --profile nginx up -d
```

## Method 4: Kubernetes

### Deployment YAML

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: silent-watcher
  labels:
    app: silent-watcher
spec:
  replicas: 1
  selector:
    matchLabels:
      app: silent-watcher
  template:
    metadata:
      labels:
        app: silent-watcher
    spec:
      containers:
      - name: silent-watcher
        image: silent-watcher:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: silent-watcher-secrets
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: silent-watcher-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: silent-watcher-service
spec:
  selector:
    app: silent-watcher
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace silent-watcher

# Create secrets
kubectl create secret generic silent-watcher-secrets \
  --from-env-file=.env \
  -n silent-watcher

# Apply deployment
kubectl apply -f k8s/ -n silent-watcher

# Check status
kubectl get pods -n silent-watcher
kubectl logs -f deployment/silent-watcher -n silent-watcher
```

## Reverse Proxy Setup

### Nginx Configuration

Create `/etc/nginx/sites-available/silent-watcher`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support
    location /api/websocket {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/silent-watcher /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Apache Configuration

Create `/etc/apache2/sites-available/silent-watcher.conf`:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName your-domain.com
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem
    
    # Security headers
    Header always set X-Frame-Options DENY
    Header always set X-Content-Type-Options nosniff
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    
    # Proxy configuration
    ProxyPreserveHost On
    ProxyRequests Off
    
    # Main application
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # WebSocket support
    ProxyPass /api/websocket ws://localhost:3000/api/websocket
    ProxyPassReverse /api/websocket ws://localhost:3000/api/websocket
</VirtualHost>
```

## SSL/TLS Setup

### Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Monitoring & Logging

### Log Management

```bash
# View application logs
tail -f data/logs/app.log

# View error logs
tail -f data/logs/error.log

# View PM2 logs
pm2 logs silent-watcher

# View system logs
sudo journalctl -u silent-watcher -f
```

### Log Rotation

Create `/etc/logrotate.d/silent-watcher`:

```
/home/silentbot/silent-watcher/data/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 silentbot silentbot
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Health Monitoring

Set up monitoring with tools like:

- **Uptime Kuma** - Self-hosted monitoring
- **Prometheus + Grafana** - Metrics and dashboards
- **New Relic** - Application performance monitoring

Example health check script:

```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ Silent Watcher is healthy"
    exit 0
else
    echo "❌ Silent Watcher is unhealthy (HTTP $RESPONSE)"
    exit 1
fi
```

## Backup Strategy

### Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/home/silentbot/backups"
DB_PATH="/home/silentbot/silent-watcher/data/database/silent-watcher.db"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
sqlite3 $DB_PATH ".backup $BACKUP_DIR/silent-watcher_$DATE.db"

# Compress backup
gzip "$BACKUP_DIR/silent-watcher_$DATE.db"

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: silent-watcher_$DATE.db.gz"
```

### Automated Backups

Add to crontab:

```bash
# Edit crontab
crontab -e

# Add backup job (daily at 2 AM)
0 2 * * * /home/silentbot/scripts/backup.sh
```

## Security Considerations

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# iptables
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

### Application Security

1. **Environment Variables**: Never commit `.env` files
2. **JWT Secret**: Use a strong, random secret
3. **Rate Limiting**: Configure appropriate limits
4. **CORS**: Set specific origins in production
5. **HTTPS**: Always use SSL/TLS in production
6. **Updates**: Keep dependencies updated

### File Permissions

```bash
# Set proper permissions
chmod 600 .env
chmod -R 755 data/
chown -R silentbot:silentbot data/
```

## Performance Optimization

### Node.js Optimization

```bash
# Set Node.js options
export NODE_OPTIONS="--max-old-space-size=1024"
```

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chatId);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(senderId);
CREATE INDEX IF NOT EXISTS idx_message_events_message_id ON message_events(messageId);
```

## Troubleshooting

### Common Issues

1. **Port in use**: Change `WEB_PORT` in `.env`
2. **Database locked**: Stop all instances and restart
3. **WhatsApp disconnection**: Clear auth data and re-authenticate
4. **Memory issues**: Increase swap space or RAM
5. **Permission denied**: Check file permissions

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Enable Node.js debugging
DEBUG=* npm start
```

## Scaling Considerations

For high-traffic deployments:

1. **Load Balancing**: Use multiple instances behind a load balancer
2. **Database**: Consider PostgreSQL for better performance
3. **Caching**: Implement Redis for session storage
4. **CDN**: Use a CDN for static assets
5. **Monitoring**: Implement comprehensive monitoring

This completes the deployment guide. Choose the method that best fits your infrastructure and requirements.
