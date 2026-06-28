$status = git status --porcelain
foreach ($line in $status) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    
    $file = $line.Substring(3)
    # Remove surrounding quotes if they exist
    if ($file.StartsWith('"') -and $file.EndsWith('"')) {
        $file = $file.Substring(1, $file.Length - 2)
    }
    
    Write-Host "----------------------------------------"
    Write-Host "Processing: $file"
    
    # Add file
    git add "$file"
    
    # Commit
    $msg = "Update $file"
    git commit -m $msg
    
    # Push
    git push
}
Write-Host "All files processed."
