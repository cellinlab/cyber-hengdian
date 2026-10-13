/// <reference types="vite/client" />
if(location.pathname==='/render'){
 const {initRender}=await import('./render');
 await initRender();
}else{
 const [{createRoot},{App}]=await Promise.all([import('react-dom/client'),import('./ui/App'),import('./ui/styles.css')]);
 createRoot(document.getElementById('root')!).render(<App/>);
}
