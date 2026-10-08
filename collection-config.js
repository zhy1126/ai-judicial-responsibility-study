// Formal collection uses separate credentials, progress and server assignment blocks from pilot runs.
window.STUDY_COLLECTION={
  enabled:true,
  baseUrl:'https://zhy031126.pythonanywhere.com',
  adminUrl:'https://www.pythonanywhere.com/user/zhy031126/files/home/zhy031126/judicial-study/private',
  mode:new URLSearchParams(location.search).get('test')==='1'?'pilot':'formal'
};
