param(
  [switch]$SmokeTest
)

$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$secureKey = $null
$plainKey = $null
$keyPointer = [IntPtr]::Zero
$exitCode = 1

Push-Location -LiteralPath $workspacePath
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw '빌드에 실패해 OpenAI 실행을 중단했습니다.'
  }

  $secureKey = Read-Host -Prompt 'OpenAI API 키를 붙여넣고 Enter' -AsSecureString
  $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ([string]::IsNullOrWhiteSpace($plainKey)) {
    throw 'API 키가 입력되지 않았습니다.'
  }

  $env:INTERRO_AI_PROVIDER = 'openai'
  $env:OPENAI_API_KEY = $plainKey
  $electronPath = Join-Path $workspacePath 'node_modules\.bin\electron.cmd'
  $electronArguments = @('.')
  if ($SmokeTest) {
    $electronArguments += '--openai-smoke-test'
  }

  & $electronPath @electronArguments
  $exitCode = $LASTEXITCODE
}
finally {
  Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:INTERRO_AI_PROVIDER -ErrorAction SilentlyContinue
  $plainKey = $null
  if ($keyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  }
  Pop-Location
}

exit $exitCode
