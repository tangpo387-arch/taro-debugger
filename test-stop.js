const { Subject, BehaviorSubject, combineLatest, debounceTime } = require('rxjs');

const cacheUpdate$ = new BehaviorSubject(undefined);
const execState$ = new BehaviorSubject('stopped');
const activeThreadId$ = new BehaviorSubject(1);

combineLatest([execState$, activeThreadId$, cacheUpdate$])
  .pipe(debounceTime(10))
  .subscribe(([execState, activeThreadId]) => {
    console.log('updateTree', { execState, activeThreadId });
  });

setTimeout(() => {
  console.log('triggering fetchFrames completion');
  cacheUpdate$.next();
}, 50);

