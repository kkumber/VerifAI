module.exports = {
    apps: [
        {
            name: 'verif-ai',
            script: 'index.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '300M',
            env: {
                NODE_ENV: 'development',
                API_PORT: 3105
            },
            env_production: {
                NODE_ENV: 'production',
                API_PORT: 3105
            }
        }
    ]
};
