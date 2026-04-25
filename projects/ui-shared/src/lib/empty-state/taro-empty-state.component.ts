import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'taro-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './taro-empty-state.component.html',
  styleUrl: './taro-empty-state.component.scss'
})
export class TaroEmptyStateComponent {
  @Input() public icon?: string;
  @Input({ required: true }) public message!: string;
  @Input() public description?: string;
  @Input() public centered: boolean = true;
}
