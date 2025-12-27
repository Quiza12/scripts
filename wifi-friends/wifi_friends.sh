#!/bin/bash

# Define the CSV file
CSV_FILE="wifi_friends.csv"

# Create the CSV file if it doesn't exist
if [ ! -f "$CSV_FILE" ]; then
  echo "Network Name,First Found" > "$CSV_FILE"  # Add the header to the CSV file
fi

# Start the infinite loop
while true; do
  clear  # Clear the terminal screen
  
  # Capture and filter Wi-Fi networks
  system_profiler SPAirPortDataType | awk '/Other Local Wi-Fi Networks:/ {flag=1; next} /^[[:space:]]*awdl0:/ {flag=0} flag && /^[[:space:]]{12}[^[:space:]]+:$/ {
    gsub(/:$/, ""); gsub(/^[[:space:]]+/, ""); if (!skip_empty && $0 ~ /^$/) {skip_empty=1; next} print 
  }' | sort | uniq | while read network; do
    # Check if the network name is already in the CSV file
    if ! cut -d',' -f1 "$CSV_FILE" | grep -qxF "$network"; then
      timestamp=$(date +"%Y-%m-%d %H:%M:%S")  # Get the current timestamp
      echo "$network,$timestamp" >> "$CSV_FILE"  # Append the network and timestamp to the CSV file
    fi
    # Print the network to the terminal
    echo "$network"
  done

  # Sort the CSV file, ignoring the header
  (head -n 1 "$CSV_FILE"; tail -n +2 "$CSV_FILE" | sort) > temp.csv && mv temp.csv "$CSV_FILE"

  sleep 15  # Wait 15 seconds before running the loop again
done