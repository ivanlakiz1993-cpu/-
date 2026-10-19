param([string]$Output = 'model-after.png', [switch]$Reload, [string]$Url = '', [int]$Width = 1600, [int]$Height = 1000, [string]$Expression = '')
$tabs = (Invoke-WebRequest http://127.0.0.1:9333/json -UseBasicParsing).Content | ConvertFrom-Json
$tab = $tabs | Where-Object type -eq 'page' | Select-Object -First 1
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$cancel = [Threading.CancellationTokenSource]::new(20000)
$socket.ConnectAsync([uri]$tab.webSocketDebuggerUrl, $cancel.Token).GetAwaiter().GetResult()
$script:messageId = 0
function Invoke-CDP($method, $parameters) {
 $script:messageId++
 $json = @{id=$script:messageId;method=$method;params=$parameters} | ConvertTo-Json -Depth 10 -Compress
 $bytes = [Text.Encoding]::UTF8.GetBytes($json)
 $socket.SendAsync([ArraySegment[byte]]::new($bytes),[Net.WebSockets.WebSocketMessageType]::Text,$true,$cancel.Token).GetAwaiter().GetResult()
 do {
  $stream = [IO.MemoryStream]::new()
  do {
   $buffer = [byte[]]::new(65536)
   $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer),$cancel.Token).GetAwaiter().GetResult()
   $stream.Write($buffer,0,$received.Count)
  } while (!$received.EndOfMessage)
  $response = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
  $stream.Dispose()
 } while ($response.id -ne $script:messageId)
 return $response
}
Invoke-CDP 'Emulation.setDeviceMetricsOverride' @{width=$Width;height=$Height;deviceScaleFactor=1;mobile=$false} | Out-Null
if ($Url) { Invoke-CDP 'Page.navigate' @{url=$Url} | Out-Null; Start-Sleep -Seconds 3 }
if ($Reload) { Invoke-CDP 'Page.reload' @{ignoreCache=$true} | Out-Null; Start-Sleep -Seconds 3 }
if ($Expression) { Invoke-CDP 'Runtime.evaluate' @{expression=$Expression} | ConvertTo-Json -Depth 6 }
Invoke-CDP 'Runtime.evaluate' @{expression='document.body.innerText + " READY:" + document.querySelector("[data-testing-equipment]").className'} | ConvertTo-Json -Depth 6
$shot = Invoke-CDP 'Page.captureScreenshot' @{}
[IO.File]::WriteAllBytes((Join-Path $PWD $Output),[Convert]::FromBase64String($shot.result.data))
$socket.Dispose()
