// ThermoSentinel — simple flow

title ThermoSentinel Architecture

direction right

User [icon: users]
Amplify [icon: aws-Amplify, label: "Static dashboard"]
ApiGateway [icon: aws-api-gateway, label: "HTTP API"]
Lambda [icon: aws-lambda, label: "Sensor API"]
Fog [icon: server, label: "Fog + simulator"]
Database [icon: database, label: "Turso optional"]

User > Amplify: dashboard
User > ApiGateway: /api/*
Fog > ApiGateway: ingest
ApiGateway > Lambda
Lambda <> Database
