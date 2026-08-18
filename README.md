# ARCONET

Spatial EDL recovery interface with Apple-grade UI design.

## Overview

ARCONET provides a visionOS-inspired recovery dashboard for Qualcomm EDL devices,
featuring a "space landscape" visual language with spacecraft telemetry aesthetics.

## Architecture

- **Frontend**: Spatial recovery interface with recovery orbit visualization
- **Backend**: EDL device management and recovery orchestration APIs
- **Deployment**: Vercel (frontend) + macOS (EDL backend)

## Features

- Device-centric spatial UI
- Recovery state visualization (Detect → Identify → Authenticate → Flash → Verify)
- Progressive disclosure diagnostics
- Confidence-gated operations
- Real-time telemetry integration
