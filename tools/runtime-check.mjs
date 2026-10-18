const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<12)){
 console.error('Для этой сборки нужен Node.js 22.12 или новее. Установите Node.js, затем повторите запуск.');
 process.exit(1);
}
