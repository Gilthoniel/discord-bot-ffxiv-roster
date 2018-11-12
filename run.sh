#!/bin/bash

kill $(pgrep npm)
nohup npm start &
