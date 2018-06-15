import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter, HostListener,
  Input,
  OnInit,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import {PdfjsItem, ThumbnailLayout} from '../../classes/pdfjs-objects';
import {PDFPromise, PDFRenderTask} from 'pdfjs-dist';
import {Pdfjs} from '../../services';
import {PdfjsControl} from '../../classes/pdfjs-control';
import {BehaviorSubject, Subscription} from 'rxjs';
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';

@Component({
  selector: 'pdfjs-thumbnail',
  templateUrl: './pdfjs-thumbnail.component.html',
  styleUrls: ['./pdfjs-thumbnail.component.css']
})
export class PdfjsThumbnailComponent implements OnInit, OnDestroy {

  @ViewChild('canvas')
  private canvasRef: ElementRef;

  @Output()
  rendered: EventEmitter<PdfjsItem> = new EventEmitter<PdfjsItem>();

  @Output()
  showPreview: EventEmitter<PdfjsItem & DOMRect> = new EventEmitter<PdfjsItem & DOMRect>();

  @Output()
  removeItem: EventEmitter<PdfjsItem> = new EventEmitter<PdfjsItem>();

  @Output()
  selectItem: EventEmitter<PdfjsItem> = new EventEmitter<PdfjsItem>();

  @Input()
  pdfjsControl: PdfjsControl;

  @Input()
  preview = false;

  @Input()
  draggable = false;

  @Input()
  layout: ThumbnailLayout = ThumbnailLayout.HORIZONTAL;

  @Input()
  removable = false;

  @Input()
  fitSize = 100;

  @Input()
  quality: 1 | 2 | 3 | 4 | 5 = 2;

  rotateSubscription: Subscription;

  item$: BehaviorSubject<PdfjsItem> = new BehaviorSubject<PdfjsItem>(null);
  itemToRender$: BehaviorSubject<PdfjsItem> = new BehaviorSubject<PdfjsItem>(null);

  _item: PdfjsItem;

  pdfRenderTask: PDFRenderTask;

  @Input()
  set item(item: PdfjsItem) {
    this.item$.next(item);
    this._item = item;
  }

  get item(): PdfjsItem {
    return this._item;
  }

  @HostListener('mouseover', ['$event'])
  mouseOver($event: MouseEvent) {
    if (this.preview) {
      const rectList: DOMRectList = (this.elementRef.nativeElement as HTMLElement).getClientRects() as DOMRectList;
      const r: DOMRect = rectList[0];
      const rect = {
        bottom: r.bottom, height: r.height, left: $event.clientX, right: $event.clientY,
        top: r.top, width: r.width, x: $event.clientX, y: $event.clientY
      };
      this.showPreview.emit(Object.assign(this.item, rect));
    }
  }

  constructor(private elementRef: ElementRef, private pdfjs: Pdfjs) {
  }

  onClick(event: MouseEvent) {
    this.selectItem.emit(this.item);
  }

  ngOnInit() {
    this.item$.subscribe((item: PdfjsItem) => {
      if (!!this.rotateSubscription) {
        this.rotateSubscription.unsubscribe();
      }
      if (!!item) {
        this.itemToRender$.next(item);
        this.rotateSubscription = item.rotate$.subscribe((rot: number) => {
          this.itemToRender$.next(item);
        });
      }
    });
    this.itemToRender$.pipe(
      debounceTime(100),
      distinctUntilChanged((x: PdfjsItem, y: PdfjsItem) => {
        return !((!x && !!y) || (!!x && !y) || (!!x && !!y &&
          x.pdfId !== y.pdfId ||
          x.pageIdx !== y.pageIdx ||
          x.rotate !== y.rotate));
      })
    ).subscribe((item: PdfjsItem) => {
      this.renderPdfjsItem(item);
    });
  }

  renderPdfjsItem(pdfjsItem: PdfjsItem) {
    this.cancelRenderTask();
    const thumbnail: HTMLElement = this.elementRef.nativeElement;
    thumbnail.classList.add('not_rendered');
    if (!!pdfjsItem) {
      // fixed size used for fit
      const canvasSize = this.fitSize - 10;

      const canvas: HTMLCanvasElement = this.canvasRef.nativeElement;
      let promise: PDFPromise<PDFPromise<any>>;
      if (this.layout === ThumbnailLayout.VERTICAL) {
        (this.elementRef.nativeElement as HTMLElement).style.width = `${this.fitSize}px`;
        promise = this.pdfjs.renderItemInCanvasWidthFitted(pdfjsItem, this.quality, canvas, canvasSize);
      } else {
        (this.elementRef.nativeElement as HTMLElement).style.height = `${this.fitSize}px`;
        promise = this.pdfjs.renderItemInCanvasHeightFitted(pdfjsItem, this.quality, canvas, canvasSize);
      }
      promise.then((obj: any) => {
        thumbnail.classList.remove('not_rendered');
        this.rendered.emit(pdfjsItem);
        this.pdfRenderTask = obj.pdfRenderTask as PDFRenderTask;
      });
    }
  }

  ngOnDestroy() {
    this.cancelRenderTask();
    this.pdfjs.destroyCanvas(this.canvasRef.nativeElement);
  }

  private cancelRenderTask() {
    if (!!this.pdfRenderTask && this.pdfRenderTask.cancel) {
      this.pdfRenderTask.cancel();
    }
  }

}
